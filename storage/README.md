# storage/

Local filesystem location for uploaded and generated workbook files during
development. Path is controlled by `STORAGE_DIR` in `backend/app/core/config.py`.

This is a placeholder for local development only. It will be replaced by
cloud object storage (e.g. S3) in a later milestone — only the storage
service implementation will change, not the code that calls it.

Contents of this folder (except this file) are gitignored.
