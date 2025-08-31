import drive from './drive';
import fs from 'fs';
import path from 'path';

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