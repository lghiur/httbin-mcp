# OpenAPI to MCP Generator

A tool that converts OpenAPI/Swagger specifications into Model Context Protocol (MCP) tools for AI assistant integration.

## Overview

This project creates a dynamic MCP server that generates tools based on an OpenAPI specification. It enables easy integration of REST APIs with AI assistants via the Model Context Protocol.

## Features

- Dynamic loading of OpenAPI specs from file or URL
- Customizable mapping of OpenAPI operations to MCP tools
- Support for [OpenAPI Overlays](#openapi-overlays) to modify OpenAPI specs without changing the original files
- Advanced filtering of operations using glob patterns for both operationId and URL paths
- Comprehensive parameter handling with format preservation and location metadata
- API authentication handling
- OpenAPI metadata (title, version, description) used to configure the MCP server
- Hierarchical description fallbacks (operation description → operation summary → path summary)
- Custom HTTP headers support via environment variables and CLI
- X-MCP header for API request tracking and identification
- Support for custom `x-mcp` extensions at the path level to override tool names and descriptions

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd openapi-to-mcp-generator

# Install dependencies
npm install

# Build the project
npm run build
```

## Usage

```bash
# Start the MCP server
npm start

# Development mode with auto-reload
npm run dev
```

### Command Line Options

You can also run the application with command-line arguments:

```bash
# Start with specific OpenAPI spec file
node dist/server.js --spec=./path/to/openapi.json

# Apply overlays to the spec
node dist/server.js --spec=./path/to/openapi.json --overlays=./path/to/overlay.json

# Include only specific operations (supports glob patterns)
node dist/server.js --spec=./path/to/openapi.json --whitelist="getPet*,POST:/users/*"

# Specify target API URL
node dist/server.js --spec=./path/to/openapi.json --targetUrl=https://api.example.com

# Set custom port
node dist/server.js --spec=./path/to/openapi.json --port=3000

# Add custom headers to all API requests
node dist/server.js --spec=./path/to/openapi.json --headers='{"X-Api-Version":"1.0.0"}'  

# Disable the X-MCP header
node dist/server.js --spec=./path/to/openapi.json --disableXMcp
```

## Configuration

Configuration is managed via environment variables, command-line options, or a JSON configuration file:

### Environment Variables

You can set these in a `.env` file or directly in your environment:

- `OPENAPI_SPEC_PATH`: Path to OpenAPI spec file
- `OPENAPI_OVERLAY_PATHS`: Comma-separated paths to overlay JSON files
- `MCP_SERVER_PORT`: Port for the MCP server (default: 8080)
- `TARGET_API_BASE_URL`: Base URL for API calls (overrides OpenAPI servers)
- `MCP_WHITELIST_OPERATIONS`: Comma-separated list of operation IDs or URL paths to include (supports glob patterns like `getPet*` or `GET:/pets/*`)
- `MCP_BLACKLIST_OPERATIONS`: Comma-separated list of operation IDs or URL paths to exclude (supports glob patterns, ignored if whitelist used)
- `API_KEY`: API Key for the target API (if required)
- `SECURITY_SCHEME_NAME`: Name of the security scheme requiring the API Key
- `SECURITY_CREDENTIALS`: JSON string containing security credentials for multiple schemes
- `CUSTOM_HEADERS`: JSON string containing custom headers to include in all API requests
- `HEADER_*`: Any environment variable starting with `HEADER_` will be added as a custom header (e.g., `HEADER_X_API_Version=1.0.0` adds the header `X-API-Version: 1.0.0`)
- `DISABLE_X_MCP`: Set to `true` to disable adding the `X-MCP: 1` header to all API requests
- `CONFIG_FILE`: Path to a JSON configuration file

### JSON Configuration

You can also use a JSON configuration file instead of environment variables or command-line options. The generator will look for configuration files in the following order:

1. Path specified by `--config` command-line option
2. Path specified by `CONFIG_FILE` environment variable
3. `config.json` in the current directory
4. `openapi-mcp.json` in the current directory
5. `.openapi-mcp.json` in the current directory

Example JSON configuration file:

```json
{
  "spec": "./path/to/openapi-spec.json",
  "overlays": "./path/to/overlay1.json,./path/to/overlay2.json",
  "port": 8080,
  "targetUrl": "https://api.example.com",
  "whitelist": "getPets,createPet,/pets/*",
  "blacklist": "deletePet,/admin/*",
  "apiKey": "your-api-key",
  "securitySchemeName": "ApiKeyAuth",
  "securityCredentials": {
    "ApiKeyAuth": "your-api-key",
    "OAuth2": "your-oauth-token"
  },
  "headers": {
    "X-Custom-Header": "custom-value",
    "User-Agent": "OpenAPI-MCP-Client/1.0"
  },
  "disableXMcp": false
}
```

A full example configuration file with explanatory comments is available at `config.example.json` in the root directory.

### Configuration Precedence

Configuration settings are applied in the following order of precedence (highest to lowest):

1. Command-line options
2. Environment variables
3. JSON configuration file

## Customizing and Publishing Your Own Version

You can use this repository as a base for creating your own customized OpenAPI to MCP integration. This section explains how to fork the repository, customize it for your specific APIs, and publish it as a package.

### Forking and Customizing

1. **Fork the Repository**:
   Fork this repository on GitHub to create your own copy that you can customize.

2. **Add Your OpenAPI Specs**:
   ```bash
   # Create a specs directory if it doesn't exist
   mkdir -p specs
   
   # Add your OpenAPI specifications
   cp path/to/your/openapi-spec.json specs/
   
   # Add any overlay files
   cp path/to/your/overlay.json specs/
   ```

3. **Configure Default Settings**:
   Create a custom config file that will be bundled with your package:
   ```bash
   # Copy the example config
   cp config.example.json config.json
   
   # Edit the config to point to your bundled specs
   # and set any default settings
   ```

4. **Update package.json**:
   ```json
   {
     "name": "your-custom-mcp-generator",
     "version": "1.0.0",
     "description": "Your customized MCP generator for specific APIs",
     "files": [
       "dist/**/*",
       "config.json",
       "specs/**/*",
       "README.md"
     ]
   }
   ```

5. **Ensure Specs are Bundled**:
   The `files` field in package.json (shown above) ensures your specs and config file will be included in the published package.

### Customizing the GitHub Workflow

The repository includes a GitHub Actions workflow for automatic publishing to npm. To customize it for your forked repo:

1. **Update the Workflow Name**:
   Edit `.github/workflows/publish-npm.yaml` to update the name if desired:
   ```yaml
   name: Publish My Custom MCP Package
   ```

2. **Set Package Scope (if needed)**:
   If you want to publish under an npm organization scope, uncomment and modify the scope line in the workflow file:
   ```yaml
   - name: Setup Node.js
     uses: actions/setup-node@v4
     with:
       node-version: "18"
       registry-url: "https://registry.npmjs.org/"
       # Uncomment and update with your organization scope:
       scope: "@your-org"
   ```

3. **Set Up npm Token**:
   Add your npm token as a GitHub secret named `NPM_TOKEN` in your forked repository's settings.

### Publishing Your Customized Package

Once you've customized the repository:

1. **Create and Push a Tag**:
   ```bash
   # Update version in package.json (optional, the workflow will update it based on the tag)
   npm version 1.0.0
   
   # Push the tag
   git push --tags
   ```

2. **GitHub Actions will**:
   - Automatically build the package
   - Update version in package.json to match the tag
   - Publish to npm with your bundled specs and config

### Usage After Publication

Users of your customized package can install and use it with npm:

```bash
# Install your customized package
npm install your-custom-mcp-generator -g

# Run it
your-custom-mcp-generator
```

They can override your default settings via environment variables or command line options as described in the Configuration section.

## License

MIT
