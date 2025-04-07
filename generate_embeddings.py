import json
import os
import time
from dotenv import load_dotenv
from openai import OpenAI, RateLimitError, APIError

# --- Configuration ---
INPUT_JSON_PATH = './knowledge.json'
OUTPUT_JS_PATH = './knowledge_embeddings.js'
EMBEDDING_MODEL = "text-embedding-3-small"
# OpenAI API allows batching, check their latest limits if needed.
# For simplicity with a small dataset, we'll process one by one,
# but add a small delay to be extremely safe with potential rate limits.
DELAY_BETWEEN_REQUESTS = 0.1 # seconds delay between embedding requests
# ---------------------

def load_knowledge_base(filepath):
    """Loads the knowledge base from a JSON file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"Successfully loaded {len(data)} items from {filepath}")
        return data
    except FileNotFoundError:
        print(f"Error: Input file not found at {filepath}")
        return None
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON from {filepath}")
        return None
    except Exception as e:
        print(f"An unexpected error occurred while loading {filepath}: {e}")
        return None

def get_embedding(client, text, model=EMBEDDING_MODEL):
    """Generates embedding for a single text using OpenAI API."""
    try:
        response = client.embeddings.create(input=[text], model=model)
        if response.data and len(response.data) > 0:
            return response.data[0].embedding
        else:
            print(f"Warning: No embedding data returned for text: {text[:50]}...")
            return None
    except RateLimitError:
        print("Rate limit exceeded, waiting 10 seconds...")
        time.sleep(10)
        return get_embedding(client, text, model) # Retry after delay
    except APIError as e:
        print(f"OpenAI API Error for text '{text[:50]}...': {e}")
        return None # Skip this item on API error
    except Exception as e:
        print(f"An unexpected error occurred getting embedding for text '{text[:50]}...': {e}")
        return None

def generate_knowledge_embeddings():
    """Generates embeddings for the knowledge base and writes to a JS file."""
    load_dotenv() # Load variables from .env file
    api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        print("Error: OPENAI_API_KEY not found in .env file or environment variables.")
        return

    try:
        client = OpenAI(api_key=api_key)
    except Exception as e:
        print(f"Error initializing OpenAI client: {e}")
        return

    knowledge_data = load_knowledge_base(INPUT_JSON_PATH)
    if not knowledge_data:
        return

    knowledge_base_with_embeddings = []
    total_items = len(knowledge_data)
    print(f"\nStarting embedding generation using model: {EMBEDDING_MODEL}")

    for i, item in enumerate(knowledge_data):
        print(f"Processing item {i + 1}/{total_items} (ID: {item.get('id', 'N/A')})...")
        
        text_to_embed = f"{item.get('title', '')}. {item.get('text', '')}".strip()

        if not text_to_embed:
            print(f"Warning: Skipping item {item.get('id', 'N/A')} due to empty text.")
            continue

        embedding = get_embedding(client, text_to_embed)

        if embedding:
            knowledge_base_with_embeddings.append({
                "id": item.get('id'),
                "title": item.get('title'),
                "text": item.get('text'),
                "embedding": embedding # Add the embedding vector
            })
            print(f"  Embedding generated successfully.")
        else:
            print(f"  Failed to generate embedding for item {item.get('id', 'N/A')}. Skipping.")

        # Add a small delay to avoid potential rate limits with many requests
        if i < total_items - 1:
             time.sleep(DELAY_BETWEEN_REQUESTS)


    # Write the result to the output JS file
    try:
        # Format the output as a JavaScript variable assignment
        # Using json.dumps for proper escaping and formatting within the JS string
        js_output_string = f"// Generated on {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}\n"
        js_output_string += "// Contains text and embeddings for the knowledge base\n"
        js_output_string += "const knowledgeBaseWithEmbeddings = "
        # Use json.dumps with indentation for readability in the JS file
        js_output_string += json.dumps(knowledge_base_with_embeddings, indent=2, ensure_ascii=False)
        js_output_string += ";\n"

        with open(OUTPUT_JS_PATH, 'w', encoding='utf-8') as f:
            f.write(js_output_string)
        print(f"\nSuccessfully generated embeddings for {len(knowledge_base_with_embeddings)} items.")
        print(f"Output saved to {OUTPUT_JS_PATH}")

    except Exception as e:
        print(f"\nError writing output file {OUTPUT_JS_PATH}: {e}")

# --- Main Execution ---
if __name__ == "__main__":
    generate_knowledge_embeddings()