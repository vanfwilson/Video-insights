
/* 
This file is used to store notes about the codebase.
The user might ask you to modify the codebase, and you should use the notes in this file to help you understand the codebase.
This file is owned by the generate_frontend tool.
*/

/*
1.  **Upload Page**: 
    - Use `POST /api/upload` with `multipart/form-data` (field name 'file').
    - Redirect to video details page on success.

2.  **Video Details / Editor Page**:
    - Fetch video data `GET /api/videos/:id`.
    - Poll `GET /api/videos/:id/status` every 5s if status is 'uploading', 'transcribing', or 'publishing'.
    - Show 'Transcript' in a READ-ONLY text area.
    - Show 'Title', 'Description', 'Tags', 'Thumbnail Prompt' in editable inputs.
    - 'Generate Metadata' button -> `POST /api/videos/:id/generate-metadata`. Refetch data on success.
    - 'Generate Thumbnail' button -> `POST /api/videos/:id/generate-thumbnail`. Update thumbnail preview.
    - 'Save Changes' button -> `PATCH /api/videos/:id` with updated fields.
    - 'Publish' section:
        - Selector for Privacy (public, private, unlisted).
        - 'Publish to YouTube' button -> `POST /api/videos/:id/publish`.
        - If `youtubeUrl` exists, display it as a link.

3.  **Video List Page**:
    - `GET /api/videos` to list all videos.
    - Link to details page.
*/
