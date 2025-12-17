import type {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

export class Evomi implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Evomi',
        name: 'evomi',
        icon: 'file:evomi.svg',
        group: ['transform'],
        version: 1,
        subtitle: '={{$parameter["mode"]}} mode',
        description: 'Scrape web pages using the Evomi Scraper API',
        defaults: {
            name: 'Evomi',
        },
        inputs: [NodeConnectionTypes.Main],
        outputs: [NodeConnectionTypes.Main],
        usableAsTool: true,
        credentials: [
            {
                name: 'evomiApi',
                required: true,
            },
        ],
        properties: [
            {
                displayName: 'URL',
                name: 'url',
                type: 'string',
                default: '',
                required: true,
                placeholder: 'https://example.com',
                description: 'The URL of the web page to scrape. Must include http:// or https://.',
            },
            {
                displayName: 'Mode',
                name: 'mode',
                type: 'options',
                default: 'auto',
                description: 'The scraping mode to use',
                options: [
                    {
                        name: 'Auto (Recommended)',
                        value: 'auto',
                        description: 'Automatically detect the best mode. Tries HTTP first, upgrades to browser if needed.',
                    },
                    {
                        name: 'Request',
                        value: 'request',
                        description: 'Fast HTTP request without JavaScript rendering. Best for static sites like blogs and news.',
                    },
                    {
                        name: 'Browser',
                        value: 'browser',
                        description: 'Full browser with JavaScript rendering. Best for SPAs (React, Vue, Angular).',
                    },
                ],
            },
            {
                displayName: 'Output',
                name: 'output',
                type: 'options',
                default: 'json',
                description: 'The output format for the scraped content',
                options: [
                    {
                        name: 'JSON',
                        value: 'json',
                        description: 'Returns structured JSON with metadata and optional content.',
                    },
                    {
                        name: 'Markdown',
                        value: 'markdown',
                        description: 'Returns clean markdown text, ideal for AI processing.',
                    },
                    {
                        name: 'Screenshot',
                        value: 'screenshot',
                        description: 'Returns a full-page PNG screenshot. Requires Browser mode.',
                    },
                ],
            },
            {
                displayName: 'Include Content',
                name: 'includeContent',
                type: 'boolean',
                default: false,
                displayOptions: {
                    show: {
                        output: ['json'],
                    },
                },
                description: 'Whether to include the full HTML/content in the JSON response. Disable to save bandwidth when you only need metadata.',
            },
            {
                displayName: 'Wait Seconds',
                name: 'waitSeconds',
                type: 'number',
                default: 5,
                typeOptions: {
                    minValue: 0,
                    maxValue: 30,
                },
                displayOptions: {
                    show: {
                        mode: ['auto', 'browser'],
                    },
                },
                description: 'Seconds to wait after page load before capturing content (0-30). Useful for pages that load content dynamically.',
            },
            {
                displayName: 'Proxy Country',
                name: 'proxyCountry',
                type: 'string',
                default: 'US',
                placeholder: 'US',
                description: 'Two-letter ISO country code for the proxy location (e.g., US, CA, DE, GB, JP). Leave empty for default.',
            },
        ],
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const returnData: INodeExecutionData[] = [];
        const items = this.getInputData();

        let credentials;
        try {
            credentials = await this.getCredentials('evomiApi');
        } catch {
            throw new NodeOperationError(
                this.getNode(),
                'Failed to get Evomi API credentials. Please configure your API key in the credentials.',
            );
        }

        const apiKey = credentials.apiKey as string;
        if (!apiKey || apiKey.trim() === '') {
            throw new NodeOperationError(
                this.getNode(),
                'API key is empty. Please enter a valid Evomi API key in the credentials.',
            );
        }

        for (let i = 0; i < items.length; i++) {
            try {
                // Get and validate URL
                const url = (this.getNodeParameter('url', i, '') as string).trim();
                if (!url) {
                    throw new NodeOperationError(
                        this.getNode(),
                        'URL is required. Please enter a valid URL to scrape.',
                        { itemIndex: i }
                    );
                }

                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    throw new NodeOperationError(
                        this.getNode(),
                        `Invalid URL format: "${url}". URL must start with http:// or https://`,
                        { itemIndex: i }
                    );
                }

                // Validate URL structure
                try {
                    new URL(url);
                } catch {
                    throw new NodeOperationError(
                        this.getNode(),
                        `Invalid URL: "${url}". Please enter a properly formatted URL (e.g., https://example.com)`,
                        { itemIndex: i }
                    );
                }

                // Get mode and output
                let mode = this.getNodeParameter('mode', i, 'auto') as string;
                const output = this.getNodeParameter('output', i, 'json') as string;

                // Validate mode
                if (!['auto', 'request', 'browser'].includes(mode)) {
                    mode = 'auto'; // Fallback to auto if invalid
                }

                // Validate output
                if (!['json', 'markdown', 'screenshot'].includes(output)) {
                    throw new NodeOperationError(
                        this.getNode(),
                        `Invalid output format: "${output}". Must be one of: json, markdown, screenshot`,
                        { itemIndex: i }
                    );
                }

                // Screenshot requires browser mode - auto-correct with info
                if (output === 'screenshot' && mode !== 'browser') {
                    mode = 'browser';
                }

                // Get and validate proxy country
                const proxyCountry = (this.getNodeParameter('proxyCountry', i, '') as string).trim().toUpperCase();
                if (proxyCountry && !/^[A-Z]{2}$/.test(proxyCountry)) {
                    throw new NodeOperationError(
                        this.getNode(),
                        `Invalid proxy country code: "${proxyCountry}". Please use a 2-letter ISO country code (e.g., US, CA, DE, GB)`,
                        { itemIndex: i }
                    );
                }

                // Build request body
                const requestBody: Record<string, unknown> = {
                    url,
                    mode,
                };

                // Add proxy country if specified
                if (proxyCountry) {
                    requestBody.proxy_country = proxyCountry;
                }

                // Set delivery and content options based on output type
                if (output === 'json') {
                    requestBody.delivery = 'json';
                    const includeContent = this.getNodeParameter('includeContent', i, false) as boolean;
                    requestBody.include_content = includeContent;
                } else if (output === 'markdown') {
                    requestBody.delivery = 'raw';
                    requestBody.content = 'markdown';
                } else if (output === 'screenshot') {
                    requestBody.delivery = 'raw';
                    requestBody.screenshot = true;
                }

                // Only include wait_seconds for auto and browser modes
                if (mode === 'auto' || mode === 'browser') {
                    let waitSeconds = this.getNodeParameter('waitSeconds', i, 5) as number;
                    // Clamp wait_seconds to valid range
                    waitSeconds = Math.max(0, Math.min(30, waitSeconds));
                    requestBody.wait_seconds = waitSeconds;
                }

                // Make API request with error handling
                let response;
                try {
                    response = await this.helpers.httpRequest({
                        method: 'POST',
                        url: 'https://scrape.evomi.com/api/v1/scraper/realtime',
                        headers: {
                            'x-api-key': apiKey,
                            'Content-Type': 'application/json',
                            'x-integration': 'n8n',
                        },
                        body: requestBody,
                        json: true,
                        returnFullResponse: false,
                        ignoreHttpStatusErrors: true,
                    });
                } catch (requestError) {
                    const errorMessage = requestError instanceof Error ? requestError.message : 'Unknown error';
                    throw new NodeOperationError(
                        this.getNode(),
                        `Failed to connect to Evomi API: ${errorMessage}. Please check your internet connection and try again.`,
                        { itemIndex: i }
                    );
                }

                // Handle API error responses
                if (response && typeof response === 'object' && 'success' in response && response.success === false) {
                    const apiError = response.error || response.message || 'Unknown API error';
                    let userMessage = `Evomi API error: ${apiError}`;

                    // Provide helpful messages for common errors
                    if (apiError.toLowerCase().includes('invalid api key') || apiError.toLowerCase().includes('unauthorized')) {
                        userMessage = 'Invalid API key. Please check your Evomi API key in the credentials.';
                    } else if (apiError.toLowerCase().includes('insufficient credits')) {
                        userMessage = 'Insufficient credits in your Evomi account. Please add credits at https://my.evomi.com';
                    } else if (apiError.toLowerCase().includes('rate limit')) {
                        userMessage = 'Rate limit exceeded. Please wait a moment and try again, or upgrade your plan for higher limits.';
                    } else if (apiError.toLowerCase().includes('invalid url')) {
                        userMessage = `The URL "${url}" could not be scraped. Please verify the URL is accessible.`;
                    }

                    throw new NodeOperationError(this.getNode(), userMessage, { itemIndex: i });
                }

                returnData.push({
                    json: response ?? { success: true, message: 'Request completed' },
                    pairedItem: i,
                });
            } catch (error) {
                if (this.continueOnFail()) {
                    const errorMessage = error instanceof NodeOperationError
                        ? error.message
                        : (error instanceof Error ? error.message : 'An unexpected error occurred');
                    returnData.push({
                        json: {
                            success: false,
                            error: errorMessage,
                            itemIndex: i,
                        },
                        pairedItem: i,
                    });
                } else {
                    if (error instanceof NodeOperationError) {
                        throw error;
                    }
                    throw new NodeOperationError(
                        this.getNode(),
                        error instanceof Error ? error.message : 'An unexpected error occurred',
                        { itemIndex: i }
                    );
                }
            }
        }

        return [returnData];
    }
}

