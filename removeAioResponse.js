db = connect("mongodb://localhost:27017/iotsrv");

db.values.find({
    "aioResponse.response": { $regex: "data created_at may not be in the future" }
}).forEach(function(doc) {
    db.values.updateOne(
        { _id: doc._id },
        { $unset: { aioResponse: "", aioStatus: "" } }
    );
    print(`Removed aioResponse and aioStatus from document with _id: ${doc._id}`);
});

print('Completed removing invalid aioResponse and aioStatus properties.');