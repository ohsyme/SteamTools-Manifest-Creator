const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

// ✅ Configuration
const CONFIG = {
    APP_ID: 2651280, // use steamdb to get appid
    DEPOT_ID: 2651281, // use steamdb to get depotid ( pick latest but big size that contains games files  )
    USERNAME: "", // if you have account with paid games put here 
    PASSWORD: "", // if you have account with paid games put here
    DEPOT_KEYS_FILE: "ManifestHub/depotkeys.json",
};

// ✅ Paths
const OUTPUT_FOLDER = `output_${CONFIG.APP_ID}`;
const DEPOTDOWNLOADER_FOLDER = path.join(OUTPUT_FOLDER, ".DepotDownloader");
const LUA_FILE = path.join(OUTPUT_FOLDER, `${CONFIG.APP_ID}.lua`);

// ✅ Ensure output folder exists
if (!fs.existsSync(OUTPUT_FOLDER)) fs.mkdirSync(OUTPUT_FOLDER, { recursive: true });

// ✅ Load manifestKey
function getManifestKey() {
    if (!fs.existsSync(CONFIG.DEPOT_KEYS_FILE)) {
        console.error(`❌ Error: ${CONFIG.DEPOT_KEYS_FILE} not found!`);
        process.exit(1);
    }
    const depotKeys = JSON.parse(fs.readFileSync(CONFIG.DEPOT_KEYS_FILE, "utf-8"));
    const key = depotKeys[CONFIG.DEPOT_ID] || "";
    if (!key) {
        console.error(`❌ Error: No key found for Depot ID ${CONFIG.DEPOT_ID} in ${CONFIG.DEPOT_KEYS_FILE}`);
        process.exit(1);
    }
    return key;
}

// ✅ Download Manifest
function downloadManifest() {
    const command = `depotdownloader -app ${CONFIG.APP_ID} -depot ${CONFIG.DEPOT_ID} -dir "${OUTPUT_FOLDER}" -username ${CONFIG.USERNAME} -password ${CONFIG.PASSWORD} -manifest-only`;

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

// ✅ Process Manifest
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

    // ✅ Extract MANIFEST_ID from filename
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

// ✅ Generate Lua Script
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

// ✅ Clean Up
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

// ✅ Start process
downloadManifest();
