import { ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';

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
    ];
    test: ICredentialTestRequest = {
        request: {
            baseURL: 'https://scrape.evomi.com',
            url: '/api/v1/scraper/health',
            method: 'GET',
            headers: {
                'x-api-key': '={{$credentials.apiKey}}',
            },
        },
    };
}

