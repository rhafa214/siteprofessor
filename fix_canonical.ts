import fs from 'fs';

let content = fs.readFileSync('src/views/CanonicalAssessmentView.tsx', 'utf8');

// Fix DriveFolderPickerModal accessToken
content = content.replace(
  '<DriveFolderPickerModal\n        isOpen={isDrivePickerOpen}\n        onClose={() => setIsDrivePickerOpen(false)}\n        onSelect={handleUploadToDrive}\n      />',
  '<DriveFolderPickerModal\n        isOpen={isDrivePickerOpen}\n        onClose={() => setIsDrivePickerOpen(false)}\n        onSelect={handleUploadToDrive}\n        accessToken={accessToken!}\n      />'
);

// Fix onSelect param signature
content = content.replace(
  'const handleUploadToDrive = async (folderId: string) => {',
  'const handleUploadToDrive = async (folderId: string, folderName: string) => {'
);

fs.writeFileSync('src/views/CanonicalAssessmentView.tsx', content);
