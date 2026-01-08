//backend/server.js
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const { GoogleGenerativeAI } = require("@google/generative-ai");

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = client.getGenerativeModel({
  model: "models/gemini-2.5-flash",
});

//helper for reformaitng the o/p of gemini response
function cleanGeminiJson(rawText) {
  if (!rawText) return "";
  let text = rawText.trim();
  text = text.replace(/^```(?:json)?\n?/, "");
  text = text.replace(/```$/, "");
  return text.trim();
}

//skill extraction
app.post("/extract-skills", async (req, res) => {
  try {
    const { title, description, explanation, techStack, githubUrl } = req.body;

    const prompt = `
You are a skill validation AI.
Read ONLY the evidence provided.
Do NOT assume skills.
Return a JSON array ONLY in this exact format:

[
  {
    "skill": "string",
    "evidence": ["detail1", "detail2", ...],
    "confidence": "Low | Medium | High",
    "reason": "Why confidence is justified"
  }
]

Project Title: ${title}
Problem Statement: ${description}
User Explanation: ${explanation}
Tech Stack: ${techStack}
GitHub URL: ${githubUrl || "N/A"}
Strictly output JSON only. Do NOT include extra text.
`;

    //calling gemini
    const response = await model.generateContent(prompt);

    //extracting raw text from gemini respnse
    const rawText = response?.response?.candidates?.[0]?.content?.parts?.[0]?.text;
    const text = cleanGeminiJson(rawText);

    if (!text) {
      return res.status(500).json({ error: "Gemini returned empty response", rawResponse: response });
    }

    let skills;
    try {
      skills = JSON.parse(text);
    } catch (e) {
      return res.status(500).json({ error: "Failed to parse Gemini JSON", raw: text });
    }

    if (!Array.isArray(skills) || skills.length === 0) {
      return res.status(200).json({
        skills: [],
        message: "No valid skills returned. Add more detailed explanations.",
      });
    }

    //returning response
    res.json({ skills });
  } catch (err) {
    console.error("Gemini endpoint error:", err);
    res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`SkillProof backend running on port ${port}`));