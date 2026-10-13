import cv2
import sys

# Decode every QR PNG produced by the verification page and report what each
# one actually contains, so the encoder is checked against real content rather
# than a structural guess.
for path in sys.argv[1:]:
    image = cv2.imread(path)
    if image is None:
        print(f'{path}: COULD NOT READ')
        continue
    detector = cv2.QRCodeDetector()
    data, points, _ = detector.detectAndDecode(image)
    print(f'{path}: {data!r}' if data else f'{path}: NO QR DECODED')