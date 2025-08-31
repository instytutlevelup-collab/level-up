import { google } from "googleapis";
import fs from 'fs';
import path from "path";

const KEYFILEPATH = path.join(
  process.cwd(),
  "src/lib/credentials/levelup-469612-5958da80342f.json"
);

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILEPATH,
  scopes: SCOPES,
});

const drive = google.drive({ version: "v3", auth });

export const uploadFileToDrive = async (file: File) => {
  const buffer = await file.arrayBuffer();
  const tempPath = path.join(process.cwd(), 'temp_' + file.name);
  fs.writeFileSync(tempPath, Buffer.from(buffer));

  const response = await drive.files.create({
    requestBody: {
      name: file.name,
      mimeType: file.type,
    },
    media: {
      mimeType: file.type,
      body: fs.createReadStream(tempPath),
    },
  });

  fs.unlinkSync(tempPath); // usuń plik tymczasowy

  return response.data.id; // zwraca ID pliku na Google Drive
};