use cibermandi_ops_IN;


// gets all colletion name from the dbatabase 

use cibermandi_ops_IN;

db.getCollectionNames().forEach(function (name) {
  print(name);
});
=======

mongosh --quiet --host 10.0.0.135 --port 27017 \
  --authenticationDatabase admin -u admin -p cibermongose \
  --eval '
    db = db.getSiblingDB("cibermandi_ops_IN");
    db.getCollectionInfos().forEach(function (info) {
      print("========================================");
      print("COLLECTION:", info.name);
      if (info.options && info.options.validator) {
        print("VALIDATOR:");
        printjson(info.options.validator);
      } else {
        print("VALIDATOR: <none>");
      }
    });
  ' > /home/ubuntu/cibermandi_validators_dump.txt
