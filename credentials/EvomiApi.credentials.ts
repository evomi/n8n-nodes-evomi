import {
    IAuthenticateGeneric,
    ICredentialTestRequest,
    ICredentialType,
    INodeProperties,
} from 'n8n-workflow';

export class EvomiApi implements ICredentialType {
    name = 'evomiApi';
    displayName = 'Evomi API';
    documentationUrl = 'https://docs.evomi.com/scraping-products-instructions/scraper-api/authentication/';
    properties: INodeProperties[] = [
        {
            displayName: 'API Key',
            name: 'apiKey',
            type: 'string',
            default: '',
            typeOptions: {
                password: true,
            },
            description: 'Your Evomi API key. Get it from the <a href="https://my.evomi.com/my/products/scraper-api-universal/playground" target="_blank">Evomi Dashboard</a>.',
        },
        {
            displayName: 'Base URL',
            name: 'baseUrl',
            type: 'string',
            default: 'https://scrape.evomi.com',
            description: 'The base URL for the Evomi Scraper API',
        },
    ];
    authenticate: IAuthenticateGeneric = {
        type: 'generic',
        properties: {
            headers: {
                'x-api-key': '={{$credentials.apiKey}}',
            },
        },
    };
    test: ICredentialTestRequest = {
        request: {
            baseURL: '={{$credentials.baseUrl}}',
            url: '/api/v1/scraper/health',
            method: 'GET',
        },
    };
}
