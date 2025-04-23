import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { config } from './config';
import { getProcessedOpenApi } from './openapiProcessor';
import { mapOpenApiToMcpTools } from './mcpMapper';
import { executeApiCall } from './apiClient';
import type { MappedTool } from './types';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod'; // Import zod for schema definition

async function startServer() {
    console.error('Starting Dynamic OpenAPI MCP Server...');

    let openapiSpec;
    try {
        openapiSpec = await getProcessedOpenApi();
    } catch (error) {
        console.error('Failed to initialize OpenAPI specification. Server cannot start.', error);
        process.exit(1);
    }

    let mappedTools: MappedTool[];
    try {
        mappedTools = mapOpenApiToMcpTools(openapiSpec);
        if (mappedTools.length === 0) {
            console.error('No tools were mapped from the OpenAPI spec based on current configuration/filtering.');
            // Decide if the server should run with no tools or exit
        }
    } catch (error) {
        console.error('Failed to map OpenAPI spec to MCP tools. Server cannot start.', error);
        process.exit(1);
    }


    // Construct the server with metadata from OpenAPI spec
    const server = new McpServer({
        name: openapiSpec.info?.title || "OpenAPI to MCP Generator",
        version: openapiSpec.info?.version || "1.0.0"
    });

    // Add OpenAPI metadata to server capabilities or log it
    if (openapiSpec.info?.description) {
        console.error(`API Description: ${openapiSpec.info.description}`);
        // Note: description is not directly supported in McpServer constructor
        // but we can log it or potentially use it elsewhere
    }

    // Register each tool with the server
    for (const tool of mappedTools) {
        const { mcpToolDefinition, apiCallDetails } = tool;
        console.error(`Registering MCP tool: ${mcpToolDefinition.name}`);  
        
        try {
            // Convert JSON Schema properties to zod schema
            const params: any = {};
            
            if (mcpToolDefinition.inputSchema && mcpToolDefinition.inputSchema.properties) {
                // Loop through all properties and create appropriate Zod schemas based on data type
                for (const [propName, propSchema] of Object.entries(mcpToolDefinition.inputSchema.properties)) {
                    if (typeof propSchema !== 'object') continue;
                    
                    const description = propSchema.description as string || `Parameter: ${propName}`;
                    const required = mcpToolDefinition.inputSchema.required?.includes(propName) || false;
                    
                    // Map JSON Schema types to Zod schema types
                    let zodSchema;
                    const schemaType = Array.isArray(propSchema.type) 
                        ? propSchema.type[0] // If type is an array (for nullable union types), use first type
                        : propSchema.type;
                        
                    // Handle different types with proper Zod schemas
                    switch (schemaType) {
                        case 'integer':
                            zodSchema = z.number().int().describe(description);
                            break;
                        case 'number':
                            zodSchema = z.number().describe(description);
                            break;
                        case 'boolean':
                            zodSchema = z.boolean().describe(description);
                            break;
                        case 'object':
                            // For objects, create a more permissive schema
                            zodSchema = z.object({}).passthrough().describe(description);
                            break;
                        case 'array':
                            // For arrays, allow any array content
                            zodSchema = z.array(z.any()).describe(description);
                            break;
                        case 'string':
                        default:
                            zodSchema = z.string().describe(description);
                            break;
                    }
                    
                    // Make it optional if not required
                    params[propName] = required ? zodSchema : zodSchema.optional();
                    
                    // Add this for debugging
                    console.error(`Registered parameter ${propName} with type: ${schemaType}, required: ${required}`);
                }
            }
            
            // Register the tool using proper MCP SDK format
            server.tool(
                mcpToolDefinition.name,
                params, // This schema will be visible in the MCP Inspector
                async (toolParams: any) => {
                    const requestId = 'req-' + Math.random().toString(36).substring(2, 9);
                    console.error(`MCP Tool '${mcpToolDefinition.name}' invoked. Request ID: ${requestId}`);
                    console.error(`Parameters received:`, toolParams);
                    
                    try {
                        // Execute the API call with the provided parameters
                        const result = await executeApiCall(apiCallDetails, toolParams);
                        
                        if (result.success) {
                            console.error(`[Request ID: ${requestId}] Tool '${mcpToolDefinition.name}' executed successfully.`);
                            
                            // Return success response
                            return {
                                content: [
                                    {
                                        type: "application/json", 
                                        data: result.data
                                    }
                                ]
                            };
                        } else {
                            console.error(`[Request ID: ${requestId}] Tool '${mcpToolDefinition.name}' execution failed: ${result.error}`);
                            
                            // Map API errors to MCP errors
                            let errorCode = ErrorCode.InternalError;
                            let errorMessage = result.error || `API Error ${result.statusCode}`;
                            
                            if (result.statusCode === 400) {
                                errorCode = ErrorCode.InvalidParams;
                                errorMessage = `Invalid parameters: ${result.error}`;
                            } else if (result.statusCode === 404) {
                                errorCode = ErrorCode.InvalidParams;
                                errorMessage = `Resource not found: ${result.error}`;
                            }
                            
                            throw new McpError(errorCode, errorMessage, result.data);
                        }
                    } catch (invocationError: any) {
                        console.error(`[Request ID: ${requestId}] Error invoking tool:`, invocationError);
                        
                        if (invocationError instanceof McpError) {
                            throw invocationError; // Re-throw known MCP errors
                        }
                        
                        throw new McpError(
                            ErrorCode.InternalError, 
                            `Internal server error: ${invocationError.message}`
                        );
                    }
                }
            );
            
            console.error(`Registered Tool: ${mcpToolDefinition.name}`);
        } catch (registerError) {
            console.error(`Failed to register tool ${mcpToolDefinition.name}:`, registerError);
        }
    }

    console.error('Starting MCP server...');
    
    // Create a server transport and connect the server
    const transport = new StdioServerTransport();
    
    try {
        // Connect the server using the transport instead of listen()
        await server.connect(transport);
        console.error(`MCP Server started and ready for connections`);
    } catch (error) {
        console.error('Error starting MCP server:', error);
        process.exit(1);
    }
}

startServer().catch(error => {
    console.error('Unhandled error during server startup:', error);
    process.exit(1);
});