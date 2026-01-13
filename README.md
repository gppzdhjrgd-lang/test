 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..a51c6b3a1bd12b41d8b32c5b8879335d37228c88
--- /dev/null
+++ b/README.md
@@ -0,0 +1,30 @@
+# Lekeplassguiden
+
+En enkel, kartbasert prototype som kombinerer åpne lekeplasser med nærliggende
+restauranter/kaféer og elbilladere ved bruk av åpne data fra OpenStreetMap
+(Overpass API).
+
+## Kom i gang
+
+1. Start en enkel webserver i repoet:
+   ```bash
+   python -m http.server 8000
+   ```
+2. Åpne `http://localhost:8000/index.html` i nettleseren.
+3. Flytt kartet til ønsket område og trykk **Oppdater kartet** for å hente data.
+
+## Hvordan scoren beregnes
+
+- **Nærhet til mat** og **nærhet til lading** får hver sin vekt (0–5).
+- Avstandene normaliseres mot valgt *idealavstand* for å gi en score mellom 0 og 1.
+- Total score er summen av de to vektede delscorene.
+
+## Datakilder
+
+- OpenStreetMap via Overpass API
+- Bakgrunnskart fra OpenStreetMap
+
+## Tips
+
+- Hvis du ikke får treff, øk radius eller flytt kartet.
+- Overpass kan være treg ved høy belastning; prøv igjen ved feil.
 
EOF
)
