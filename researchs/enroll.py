import os
import cv2
import numpy as np
import faiss
import pickle
import insightface

# Load model ArcFace
model = insightface.app.FaceAnalysis(name="buffalo_l", providers=['CPUExecutionProvider'])
model.prepare(ctx_id=0, det_size=(640, 640))

DATASET_DIR = "dataset"
INDEX_FILE = "faces.index"
META_FILE = "faces_meta.pkl"

embeddings = []
metadata = []

# Loop setiap orang di dataset
for person_name in os.listdir(DATASET_DIR):
    person_dir = os.path.join(DATASET_DIR, person_name)
    if not os.path.isdir(person_dir):
        continue

    print(f"\n📂 Memproses {person_name}...")
    for filename in os.listdir(person_dir):
        if filename.lower().endswith((".jpg", ".jpeg", ".png")):
            path = os.path.join(person_dir, filename)
            img = cv2.imread(path)

            if img is None:
                print(f"   ⚠️ {filename} tidak bisa dibaca")
                continue

            faces = model.get(img)
            if faces:
                emb = faces[0].embedding.astype("float32")
                embeddings.append(emb)
                metadata.append({"name": person_name, "file": filename})
                print(f"   ✅ {filename} berhasil di-enroll")
            else:
                print(f"   ⚠️ {filename} tidak ada wajah")

# Simpan ke FAISS
if embeddings:
    embeddings = np.array(embeddings).astype("float32")

    d = embeddings.shape[1]  # dimensi embedding (512 biasanya)
    index = faiss.IndexFlatIP(d)  # inner product (cosine similarity)
    faiss.normalize_L2(embeddings)  # normalisasi
    index.add(embeddings)

    # Simpan index & metadata
    faiss.write_index(index, INDEX_FILE)
    with open(META_FILE, "wb") as f:
        pickle.dump(metadata, f)

    print(f"\n✅ Enroll selesai, index disimpan di {INDEX_FILE}, metadata di {META_FILE}")
else:
    print("\n❌ Tidak ada wajah berhasil di-enroll")
