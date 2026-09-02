import { Client } from "@gradio/client";
import fs from "fs";

// Create a simple 1x1 dummy PNG image buffer
const dummyImageBuffer = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
fs.writeFileSync("dummy.png", dummyImageBuffer);

const fileBlob = new Blob([dummyImageBuffer], { type: "image/png" });

async function runTest() {
  console.log("Connecting to Hugging Face Space...");
  try {
    const client = await Client.connect("ivancahyadi/gf-care-demo");
    console.log("Connected. Sending prediction request...");
    
    const result = await client.predict("/predict", [fileBlob]);
    console.log("Prediction success!");
    console.log("Result length:", result.data.length);
    console.log("Overlay output:", result.data[0]);
    console.log("Metrics JSON output:", JSON.stringify(result.data[1], null, 2));
  } catch (error) {
    console.error("Test failed:", error);
  }
}

runTest();
