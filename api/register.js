import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";

export default async function handler(req, res) {
    res.setHeader("Content-Type", "application/json");

    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    const uri =
        process.env.MONGODB_URI;

    if (!uri) {
        return res.status(500).json({
            error:
                "MONGODB_URI is not configured in Vercel."
        });
    }

    let client;

    try {

        let body = req.body;

        if (typeof body === "string") {
            body = JSON.parse(body);
        }

        const username =
            String(
                body?.username || ""
            ).trim();

        const password =
            String(
                body?.password || ""
            );

        if (!username || !password) {
            return res.status(400).json({
                error:
                    "Username and password are required."
            });
        }

        if (username.length < 3) {
            return res.status(400).json({
                error:
                    "Username must be at least 3 characters."
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                error:
                    "Password must be at least 6 characters."
            });
        }

        client =
            new MongoClient(uri);

        await client.connect();

        const db =
            client.db("jhonnychatbox");

        const users =
            db.collection("users");

        const existing =
            await users.findOne({
                username: username
            });

        if (existing) {
            return res.status(409).json({
                error:
                    "Username already taken."
            });
        }

        const hashedPassword =
            await bcrypt.hash(
                password,
                12
            );

        await users.insertOne({
            username: username,

            password:
                hashedPassword,

            createdAt:
                new Date()
        });

        return res.status(201).json({
            success: true,

            message:
                "Account created successfully."
        });

    } catch (error) {

        console.error(
            "REGISTER ERROR:",
            error
        );

        return res.status(500).json({
            error:
                error?.message ||
                "Registration server error."
        });

    } finally {

        if (client) {
            try {
                await client.close();
            } catch {}
        }
    }
}
