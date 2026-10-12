# packages/db/schemas/index.ts

- Documents · type · L429-L431 — type Documents = { [K in keyof typeof schemas]: z.infer<(typeof schemas)[K]>; };
- Insert · type · L432-L434 — type Insert<K extends keyof Documents> = Omit<Documents[K], "_id"> & { _id?: ObjectId; };
- Update · type · L435-L437 — type Update<K extends keyof Documents> = Partial< Omit<Documents[K], "_id"> >;
