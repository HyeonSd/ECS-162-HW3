db = db.getSiblingDB('mydatabase');

db.createCollection('users');

db.createCollection('comments');

db.createCollection('articles');

db.users.find({email: 'alice@example.com'}).count() === 0 && db.users.insertOne({
    email: 'alice@example.com',
    hash: '$2a$10$CwTycUXWue0Thq9StjUM0uJ8DPLKXt1FYlwYpQW2G3cAwjKoh2WZK',  
    username: 'alice',
    userID: '123',
    name: 'Alice User',
    is_moderator: false
});

db.users.find({email: 'bob@example.com'}).count() === 0 && db.users.insertOne({
    email: 'bob@example.com',
    hash: '$2a$10$9BXzGKJK2yDsAy7vC.O6j.w9ROvJqDOe/uGGy3gVAfNBOD6tJ5fhW',  
    username: 'bob',
    userID: '124',
    name: 'Bob User',
    is_moderator: false
});

db.users.find({email: 'admin@example.com'}).count() === 0 && db.users.insertOne({
    email: 'admin@example.com',
    hash: '$2a$10$OPNl9DfjaYBuFAKpBxH7ZeIpMjTNZBMCPm7cxmhZ.W9ZeW0XClzR2',  
    username: 'admin',
    userID: '999',
    name: 'Admin User',
    is_moderator: true
});

if (db.comments.find().count() === 0) {
    const sampleArticleId = "nyt://article/1234abcd-5678-90ef-ghij-klmnopqrstuv";
    
    db.comments.insertMany([
        {
            article_id: sampleArticleId,
            content: "This is a test comment on the article about Sacramento.",
            author: {
                email: "alice@example.com",
                name: "Alice User"
            },
            created_at: new Date(),
            is_removed: false
        },
        {
            article_id: sampleArticleId,
            content: "I disagree with the previous comment!",
            author: {
                email: "bob@example.com",
                name: "Bob User"
            },
            created_at: new Date(),
            is_removed: false
        },
        {
            article_id: sampleArticleId,
            content: "COMMENT REMOVED BY MODERATOR!",
            author: {
                email: "alice@example.com",
                name: "Alice User"
            },
            created_at: new Date(Date.now() - 3600000), 
            is_removed: true
        },
        {
            article_id: sampleArticleId,
            content: "This is a reply to the first comment.",
            author: {
                email: "admin@example.com",
                name: "Admin User"
            },
            created_at: new Date(),
            is_removed: false,
            parent_id: db.comments.findOne({
                article_id: sampleArticleId,
                "author.email": "alice@example.com",
                is_removed: false
            })._id
        }
    ]);
}

db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "username": 1 }, { unique: true });
db.comments.createIndex({ "article_id": 1 });
db.comments.createIndex({ "parent_id": 1 });
db.comments.createIndex({ "created_at": -1 });

print('MongoDB initialization completed successfully');