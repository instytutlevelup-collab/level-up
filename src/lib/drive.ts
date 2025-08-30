import { google } from "googleapis";
import path from "path";

const KEYFILEPATH = path.join(
  process.cwd(),
  "src/lib/credentials/levelup-469612-5958da80342f.json"
);

const SCOPES = ["https://www.googleapis.com/auth/drive.readonly"];

export async function listDriveFiles() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEYFILEPATH,
    scopes: SCOPES,
  });

  const drive = google.drive({ version: "v3", auth });

  const res = await drive.files.list({
    pageSize: 10,
    fields: "files(id, name)",
  });

  return res.data.files;
}