import OpenAI from "openai";

const client = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1"
});


export default async function handler(req, res) {

    if (req.method !== "POST") {

        return res.status(405).json({
            error: "Method not allowed"
        });

    }


    try {

        let body = "";


        for await (const chunk of req) {

            body += chunk;

        }


        const contentType =
            req.headers["content-type"] || "";


        let messages = [];


        if (
            contentType.includes(
                "application/json"
            )
        ) {

            const data =
                JSON.parse(body);


            messages =
                typeof data.messages === "string"
                    ? JSON.parse(data.messages)
                    : data.messages;

        }

        else {

            const params =
                new URLSearchParams(body);


            const messagesText =
                params.get("messages");


            if (messagesText) {

                messages =
                    JSON.parse(messagesText);

            }

        }


        if (!Array.isArray(messages)) {

            return res.status(400).json({
                error: "Invalid messages"
            });

        }


        const completion =
            await client.chat.completions.create({

                model:
                    "openai/gpt-4o-mini",

                messages:
                    messages,

                temperature:
                    0.7

            });


        const reply =
            completion
                .choices?.[0]
                ?.message?.content ||
            "No response received.";


        return res.status(200).json({
            reply: reply
        });


    } catch (error) {

        console.error(
            "Jhonny API Error:",
            error
        );


        return res.status(500).json({

            error:
                error?.message ||
                "Something went wrong."

        });

    }

}
