// Direct database access for e2e setup that the app has no route for (ageing items). Same dev database as the server.
process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27027/pluck?replicaSet=rs0&directConnection=true";
export { ageItemsOf, ageListsOf } from "@pluck/db/testing";
