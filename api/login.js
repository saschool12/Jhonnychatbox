import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export default async function handler(req, res) {
    res.setHeader("Content-Type", "application/json");

    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    const uri = process.env.MONGODB_URI;
    const jwtSecret = process.env.JWT_SECRET;

    if (!uri) {
        return res.status(500).json({
            error: "MONGODB_URI is not configured in Vercel."
        });
    }

    if (!jwtSecret) {
        return res.status(500).json({
            error: "JWT_SECRET is not configured in Vercel."
        });
    }

    let client;

    try {
        let body = req.body;

        if (typeof body === "string") {
            body = JSON.parse(body);
        }

        const username =
            String(body?.username || "").trim();

        const password =
            String(body?.password || "");

        if (!username || !password) {
            return res.status(400).json({
                error: "Username and password are required."
            });
        }

        client = new MongoClient(uri);

        await client.connect();

        const db =
            client.db("jhonnychatbox");

        const users =
            db.collection("users");

        const user =
            await users.findOne({
                username: username
            });

        if (!user) {
            return res.status(401).json({
                error: "Invalid username or password."
            });
        }

        const valid =
            await bcrypt.compare(
                password,
                user.password
            );

        if (!valid) {
            return res.status(401).json({
                error: "Invalid username or password."
            });
        }

        const token =
            jwt.sign(
                {
                    userId:
                        user._id.toString(),

                    username:
                        user.username
                },

                jwtSecret,

                {
                    expiresIn: "7d"
                }
            );

        return res.status(200).json({
            success: true,
            token: token,
            username: user.username
        });

    } catch (error) {

        console.error(
            "LOGIN ERROR:",
            error
        );

        return res.status(500).json({
            error:
                error?.message ||
                "Login server error."
        });

    } finally {

        if (client) {
            try {
                await client.close();
            } catch {}
        }
    }
}
