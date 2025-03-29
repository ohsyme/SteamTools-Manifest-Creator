const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

// ✅ Configuration
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), { encoding: "utf-8" }));

const DEPOT_KEYS_FILE = path.join(__dirname, "ManifestHub", "depotkeys.json");
const OUTPUT_FOLDER = `output_${CONFIG.APP_ID}`;
const DEPOTDOWNLOADER_FOLDER = path.join(OUTPUT_FOLDER, ".DepotDownloader");
const LUA_FILE = path.join(OUTPUT_FOLDER, `${CONFIG.APP_ID}.lua`);

if (!fs.existsSync(OUTPUT_FOLDER)) fs.mkdirSync(OUTPUT_FOLDER, { recursive: true });

function getManifestKey() {
    if (!fs.existsSync(DEPOT_KEYS_FILE)) {
        console.error(`❌ Error: ${DEPOT_KEYS_FILE} not found!`);
        process.exit(1);
    }
    const depotKeys = JSON.parse(fs.readFileSync(DEPOT_KEYS_FILE, "utf-8"));
    const key = depotKeys[CONFIG.DEPOT_ID] || "";
    if (!key) {
        console.error(`❌ Error: No key found for Depot ID ${CONFIG.DEPOT_ID} in ${DEPOT_KEYS_FILE}`);
        process.exit(1);
    }
    return key;
}

function downloadManifest() {
    const command = `depotdownloader -app ${CONFIG.APP_ID} -depot ${CONFIG.DEPOT_ID} -dir "${OUTPUT_FOLDER}" -username ${CONFIG.username} -password ${CONFIG.password} -manifest-only`;

    console.log("⏳ Downloading manifest...");
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error("❌ Error running DepotDownloader:", error.message);
            return;
        }
        console.log(stdout, stderr);
        processManifest();
    });
}
function processManifest() {
    if (!fs.existsSync(DEPOTDOWNLOADER_FOLDER)) {
        console.error("❌ .DepotDownloader folder not found!");
        return;
    }

    const files = fs.readdirSync(DEPOTDOWNLOADER_FOLDER);
    const manifestFile = files.find(file => file.endsWith(".manifest"));
    if (!manifestFile) {
        console.error("❌ No manifest file found in .DepotDownloader!");
        return;
    }

    const sourcePath = path.join(DEPOTDOWNLOADER_FOLDER, manifestFile);
    const destPath = path.join(OUTPUT_FOLDER, manifestFile);
    fs.renameSync(sourcePath, destPath);
    console.log(`✅ Manifest moved to: ${destPath}`);
    const match = manifestFile.match(/_(\d+)\.manifest$/);
    if (!match) {
        console.error("❌ Failed to extract MANIFEST_ID from filename!");
        return;
    }
    const MANIFEST_ID = match[1];
    console.log(`✅ Extracted MANIFEST_ID: ${MANIFEST_ID}`);

    generateLuaScript(MANIFEST_ID);
    cleanUp();
}
function generateLuaScript(manifestId) {
    const manifestKey = getManifestKey();
    const luaScript = [
        `addappid(${CONFIG.APP_ID})`,
        `addappid(${CONFIG.DEPOT_ID}, 1, "${manifestKey}")`,
        `setManifestid(${CONFIG.DEPOT_ID}, "${manifestId}", 0)`,
    ].join("\n");

    fs.writeFileSync(LUA_FILE, luaScript);
    console.log(`✅ Lua script saved to ${LUA_FILE}`);
}
function cleanUp() {
    fs.rmSync(DEPOTDOWNLOADER_FOLDER, { recursive: true, force: true });
    console.log("✅ Deleted .DepotDownloader folder.");

    const outputFiles = fs.readdirSync(OUTPUT_FOLDER);
    outputFiles.forEach(file => {
        if (file.startsWith("manifest_") && file.endsWith(".txt")) {
            fs.unlinkSync(path.join(OUTPUT_FOLDER, file));
            console.log(`✅ Deleted extra manifest file: ${file}`);
        }
    });
}
downloadManifest();
