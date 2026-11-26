const dbResenas = db.getSiblingDB("resenas_db");

if (!dbResenas.getCollectionNames().includes("resenas")) {
    dbResenas.createCollection("resenas");
}

dbResenas.resenas.createIndex(
    { usuario_id: 1, producto_id: 1 },
    { unique: true }
);

dbResenas.resenas.createIndex({ producto_id: 1 });
