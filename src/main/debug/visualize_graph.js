const { StateGraph, END } = require("@langchain/langgraph");
const fs = require('fs');
const path = require('path');

// Define a dummy state since we are only visualizing
const agentState = {
    messages: {
        value: (x, y) => x.concat(y),
        default: () => []
    }
};

// Define dummy nodes
const agent = async (state) => {
    return { messages: ["agent response"] };
};

const tools = async (state) => {
    return { messages: ["tool result"] };
};

// Define tool nodes
const google_search = async (state) => ({ messages: ["search result"] });
const add_task = async (state) => ({ messages: ["task added"] });
const list_tasks = async (state) => ({ messages: ["tasks listed"] });
const update_task = async (state) => ({ messages: ["task updated"] });
const delete_task = async (state) => ({ messages: ["task deleted"] });

// Define the logic for conditional edges
const shouldContinue = (state) => {
    // This mimics the logic: if tool calls exist, go to tools, else end
    const lastMessage = state.messages[state.messages.length - 1];
    // In a real execution, this would check the tool name
    return "end";
};

// Build the graph
const workflow = new StateGraph({ channels: agentState });

// Add nodes
workflow.addNode("agent", agent);
workflow.addNode("google_search", google_search);
workflow.addNode("add_task", add_task);
workflow.addNode("list_tasks", list_tasks);
workflow.addNode("update_task", update_task);
workflow.addNode("delete_task", delete_task);

// Add edges
workflow.setEntryPoint("agent");

workflow.addConditionalEdges(
    "agent",
    shouldContinue,
    {
        google_search: "google_search",
        add_task: "add_task",
        list_tasks: "list_tasks",
        update_task: "update_task",
        delete_task: "delete_task",
        end: END
    }
);

workflow.addEdge("google_search", "agent");
workflow.addEdge("add_task", "agent");
workflow.addEdge("list_tasks", "agent");
workflow.addEdge("update_task", "agent");
workflow.addEdge("delete_task", "agent");

// Compile the graph
const app = workflow.compile();

// Generate the image
async function generateGraph() {
    console.log("Generating agent graph...");
    try {
        const mermaidPng = await app.getGraph().drawMermaidPng();
        const arrayBuffer = await mermaidPng.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const outputPath = path.join(__dirname, 'agent_graph.png');
        fs.writeFileSync(outputPath, buffer);

        console.log(`Graph saved to: ${outputPath}`);
    } catch (error) {
        console.error("Error generating graph:", error);
    }
}

generateGraph();
