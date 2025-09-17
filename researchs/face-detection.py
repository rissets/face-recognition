import cv2
import time
import faiss
import pickle
import numpy as np
import insightface

# ---------- CONFIG ----------
INDEX_FILE = "faces.index"     # FAISS index
META_FILE = "faces_meta.pkl"   # metadata (nama, file)
CAMERA_INDEX = 0
THRESHOLD = 0.7                # cosine similarity threshold
FRAME_SKIP = 2                 # proses tiap 2 frame
DISPLAY_VERIFY_TIME = 5        # detik menampilkan status verified
MODEL_NAME = "buffalo_l"       # insightface model
# ----------------------------

def prepare_model():
    app = insightface.app.FaceAnalysis(name=MODEL_NAME, providers=['CPUExecutionProvider'])
    app.prepare(ctx_id=0, det_size=(320, 320))  # lebih ringan dari 640
    return app

def load_faiss(index_path, meta_path):
    index = faiss.read_index(index_path)
    with open(meta_path, "rb") as f:
        metadata = pickle.load(f)
    return index, metadata

def search_face(emb, index, metadata, k=3, threshold=0.7):
    emb = emb.astype("float32").reshape(1, -1)
    faiss.normalize_L2(emb)
    D, I = index.search(emb, k)

    # Ambil hasil terbaik
    best_idx = I[0][0]
    best_score = D[0][0]
    if best_score >= threshold:
        return metadata[best_idx]["name"], best_score
    else:
        return "Unknown", best_score

def main():
    # Load index & metadata
    try:
        index, metadata = load_faiss(INDEX_FILE, META_FILE)
    except Exception as e:
        print(f"[ERROR] Tidak bisa load FAISS index: {e}")
        return

    model = prepare_model()
    cap = cv2.VideoCapture(CAMERA_INDEX)

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 320)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 240)

    if not cap.isOpened():
        print("[ERROR] Tidak bisa buka kamera.")
        return

    print("🔍 Face login aktif — hadapkan wajah ke kamera. Tekan 'q' untuk keluar.")

    frame_count = 0
    active_verifications = {}

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_count += 1

        # tampilkan status verified untuk tiap orang aktif
        for name, until in list(active_verifications.items()):
            if time.time() < until:
                cv2.putText(frame, f"Verified: {name}",
                            (50, 50 + 30*list(active_verifications.keys()).index(name)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
            else:
                del active_verifications[name]

        # proses tiap FRAME_SKIP frame
        if frame_count % FRAME_SKIP == 0:
            faces = model.get(frame)
            for face in faces:
                emb = face.embedding
                if np.linalg.norm(emb) > 0:
                    emb = emb / np.linalg.norm(emb)

                name, score = search_face(emb, index, metadata, threshold=THRESHOLD)

                # draw bounding box & label
                box = face.bbox.astype(int)
                cv2.rectangle(frame, (box[0], box[1]), (box[2], box[3]), (0,255,0), 2)
                cv2.putText(frame, f"{name} ({score:.2f})", (box[0], box[1]-10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,255,0), 2)

                # kalau wajah baru terverifikasi, catat & tampilkan
                if name != "Unknown" and name not in active_verifications:
                    print(f"\n✅ Terverifikasi atas nama: {name} (similarity={score:.4f})")
                    active_verifications[name] = time.time() + DISPLAY_VERIFY_TIME

        cv2.imshow("Face Login (FAISS)", frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
