import * as Realm from "realm-web";
import * as utils from "./utils";

// The Worker's environment bindings. See `wrangler.toml` file.
interface Bindings {
    // MongoDB Realm Application ID
    REALM_APPID: string;
    TOMORROW_API_KEY: string;
    TOMORROW_BASE_URL: string;
}

// Define type alias; available via `realm-web`
type Document = globalThis.Realm.Services.MongoDB.Document;

// Declare the interface for a "todos" document
interface Timelines extends Document {
    owner: string;
    queryId: string;
    data: any;
    startTime: any;
}

let App: Realm.App;
// const ObjectId = Realm.BSON.ObjectID;
// const ISODate = Realm.

const DB = "cst-weather";
const COLLECTION = "timelines";


// Define the Worker logic
const worker: ExportedHandler<Bindings> = {
    async fetch(req, env) {
        const url = new URL(req.url);
        App = App || new Realm.App(env.REALM_APPID);

        const method = req.method;
        const pathname = url.pathname.replace(/[/]$/, '');
        const prefix = "/api/weather";
        const searchParams = url.searchParams;
        searchParams.sort();
        const queryId = searchParams.toString();

        if (!pathname.startsWith(prefix)) {
            return utils.toError(`Unknown "${pathname}" URL;`, 404);
        }

        const token = req.headers.get('authorization');
        if (!token) return utils.toError('Unauthorized.', 401);

        try {
            const credentials = Realm.Credentials.apiKey(token);
            // Attempt to authenticate
            var user = await App.logIn(credentials);
            var client = user.mongoClient("mongodb-atlas");
        } catch (err) {
            return utils.toError("Error with authentication.", 500);
        }

        // Grab a reference to the "cloudflare.todos" collection
        const collection = client.db(DB).collection<Timelines>(COLLECTION);

        try {
            if (method === "GET") {
                if (queryId) {
                    // GET /api/todos?id=XXX
                    const found = await collection.findOne({
                        queryId: queryId
                    });
                    if (found) {
                        return utils.reply(found);
                    }
                    const remainingUrl = pathname.replace(new RegExp('^' + prefix), '');
                    const targetUrl = decodeURIComponent(remainingUrl);
                    function appendKey(sp: URLSearchParams) {
                        sp.append("apikey", env.TOMORROW_API_KEY);
                        return sp;
                    }
                    const tomorrowSearchParams = appendKey(searchParams).toString();
                    const response = await fetch(env.TOMORROW_BASE_URL + targetUrl + "?" + tomorrowSearchParams, { headers: utils.BASE_HEADERS });
                    const status = response.status;
                    if (status !== 200) {
                        return utils.toError(response.statusText, status);
                    }
                    const startTime = url.searchParams.get("startTime");
                    const payload: { data: Timelines["data"] } = await response.json();
                    const inserted = await collection.insertOne({
                        startTime: { "$date" : startTime },
                        owner: user.id,
                        data: payload.data,
                        queryId: queryId
                    });
                    if (inserted) {
                        return utils.reply({ data: payload.data });
                    }
                    return utils.reply(inserted);
                }

                // GET /api/todos
                // return utils.reply(
                //     await collection.find()
                // );
                return utils.toError("Not found", 404);
            }

            // POST /api/todos
            // if (method === 'POST') {
            //     const {todo} = await req.json();
            //     return utils.reply(
            //         await collection.insertOne({
            //             owner: user.id,
            //             done: false,
            //             todo: todo,
            //         })
            //     );
            // }

            // PATCH /api/todos?id=XXX&done=true
            // if (method === 'PATCH') {
            //     return utils.reply(
            //         await collection.updateOne({
            //             _id: new ObjectId(todoID)
            //         }, {
            //             $set: {
            //                 done: url.searchParams.get('done') === 'true'
            //             }
            //         })
            //     );
            // }

            // DELETE /api/todos?id=XXX
            // if (method === 'DELETE') {
            //     return utils.reply(
            //         await collection.deleteOne({
            //             _id: new ObjectId(todoID)
            //         })
            //     );
            // }

            // unknown method
            return utils.toError('Method not allowed.', 405);
        } catch (err) {
            const msg = (err as Error).message || 'Error with query.';
            return utils.toError(msg, 500);
        }
    }
}

// Export for discoverability
export default worker;
