export const BASE_HEADERS = {
    "content-type": "application/json;charset=UTF-8"
};

const NO_CORS_HEADERS = {
    ...BASE_HEADERS,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, PATCH, DELETE",
    // "Access-Control-Allow-Headers": "x-requested-with, Content-Type, origin, authorization, accept, access-control-allow-origin",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Allow-Credentials": true.toString()
};

export function toJSON(data: unknown, status = 200): Response {
    let body = data === null ? null : JSON.stringify(data, null, 2);
    let headers = {
        ...NO_CORS_HEADERS,
        ...(data === null ? { "Content-Length": "0" } : {})
    };
    return new Response(body, {headers, status});
}

export function toError(error: string | unknown, status = 400): Response {
    return toJSON({error}, status);
}

export function reply(output: any): Response {
    if (output != null) return toJSON(output, 200);
    return toError('Error with query', 500);
}
