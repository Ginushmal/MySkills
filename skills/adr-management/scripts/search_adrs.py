import argparse
import glob
import os

# Suppress huggingface hub warnings and force offline mode (ADR 0003)
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
os.environ["HF_HUB_OFFLINE"] = "1"

import chromadb
from chromadb.utils import embedding_functions

# Get the repository root directory (assumes script is in .agents/skills/adr-management/scripts)
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))

ADR_DIR = os.path.join(REPO_ROOT, "docs", "adr")
DB_DIR = os.path.join(REPO_ROOT, ".chroma_db")
COLLECTION_NAME = "adrs"

def init_chroma():
    client = chromadb.PersistentClient(path=DB_DIR)
    sentence_transformer_ef = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")
    collection = client.get_or_create_collection(name=COLLECTION_NAME, embedding_function=sentence_transformer_ef)
    return collection

def index_adrs():
    print(f"Indexing ADRs from {ADR_DIR}...")
    collection = init_chroma()
    
    # Read all markdown files in ADR_DIR
    md_files = glob.glob(os.path.join(ADR_DIR, "*.md"))
    
    documents = []
    metadatas = []
    ids = []
    
    for file_path in md_files:
        if os.path.basename(file_path) == "template.md":
            continue
            
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
            
        # Parse title from first line, assuming `# Title`
        title = os.path.basename(file_path)
        first_line = content.split('\n')[0].strip()
        if first_line.startswith('# '):
            title = first_line[2:]
            
        adr_id = os.path.basename(file_path).split('-')[0]
        if not adr_id.isdigit():
            adr_id = os.path.basename(file_path)
            
        documents.append(content)
        metadatas.append({"title": title, "file": file_path, "id": adr_id})
        ids.append(os.path.basename(file_path))
        
    if documents:
        collection.upsert(
            documents=documents,
            metadatas=metadatas,
            ids=ids
        )
        print(f"Indexed {len(documents)} ADR(s).")
    else:
        print("No ADRs found to index.")

def search_adrs(query):
    print(f"Searching for: '{query}'...")
    collection = init_chroma()
    
    count = collection.count()
    if count == 0:
        print("No ADRs indexed. Please run with --index first.")
        return
        
    results = collection.query(
        query_texts=[query],
        n_results=min(3, count)
    )
    
    if not results['documents'] or not results['documents'][0]:
        print("No results found.")
        return

    print("\n--- Top Results ---\n")
    for i in range(len(results['documents'][0])):
        metadata = results['metadatas'][0][i]
        doc = results['documents'][0][i]
        
        # Extract a snippet
        snippet = doc[:200].replace('\n', ' ') + "..."
        
        print(f"[{i+1}] Title: {metadata['title']} (ID: {metadata['id']})")
        print(f"    File: {metadata['file']}")
        print(f"    Snippet: {snippet}")
        print()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ADR Semantic Search Tool")
    parser.add_argument("--index", action="store_true", help="Index all ADRs in docs/adr/")
    parser.add_argument("query", nargs="*", help="The search query")
    
    args = parser.parse_args()
    
    if args.index:
        index_adrs()
    elif args.query:
        search_adrs(" ".join(args.query))
    else:
        parser.print_help()
