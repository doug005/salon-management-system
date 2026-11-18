# Professional advertisements — milestone 2

Only the owning professional manages advertisements. Admin and customer requests to management routes return 403. Ownership is derived from the session. No moderation or approval workflow exists. Old moderation metadata, if stored, is retained as historical data but is never accepted by these APIs or published as active content.

## API

- GET/POST `/api/professional/advertisements`: own list / create draft with title (1–100 characters) and optional body (up to 2000).
- PATCH/DELETE `/api/professional/advertisements/:id`: edit title/body without extending publication / delete own advertisement.
- POST `.../:id/publish`: immediate seven-day publication, maximum three active per professional. Publishing an already active ad returns 409; unpublish first to renew.
- POST `.../:id/unpublish`: immediately end visibility.
- PUT `.../:id/image`: raw PNG/JPEG/WebP request body, correct Content-Type, bearer authentication. Maximum 5 MiB input, 20 megapixels; animated/invalid inputs rejected. Output is metadata-free WebP bounded to 1600 pixels. Replacing a video removes its reference and schedules safe cleanup.
- PUT `.../:id/video`: raw MP4 or WebM, bearer authentication, exact owner only, maximum 50 MiB. MIME and container signature are checked before storing. Replacing an image removes its reference and schedules safe cleanup.
- DELETE `.../:id/media`: detach the current image/video without deleting the advertisement; unreferenced media is cleaned safely and retried after failure.
- GET `/api/public/advertisements[?professional=ID]`: latest 100 active ads from active professional accounts, safe public fields only.
- GET `/api/public/advertisements/:id/image`: image only while the advertisement is currently published. Cache-Control no-store. No direct storage path is exposed.
- GET `/api/public/advertisements/:id/video`: MP4/WebM only while published and owned by an active professional; supports byte ranges for browser playback/seeking. Cache-Control no-store. No direct storage path is exposed.

An advertisement can have one image or one video at a time, or be text-only. Expiry is exclusive: public queries require `startsAt <= now < endsAt`. At exactly seven days, media endpoints cease to be publicly accessible, even if cleanup has not run. Management derives expired status immediately. Editing preserves the period. Expiry cleanup detaches media; republishing after cleanup requires uploading media again if desired.

## Storage and cleanup

Development defaults to `.local/ad-images/` (ignored, project-local). Random server-generated keys prevent path traversal; original filenames are never used. Image binaries never enter MongoDB. Image records track staged/ready/deleting state and sanitized failure count/time. Metadata records precede storage writes so interrupted uploads can be reclaimed.

The API worker runs cleanup every 30 seconds, expires advertisements, detaches media, and deletes unreferenced assets. Replacement/removal/deletion orphan assets are reclaimed on that cycle. Staged uploads receive a one-hour grace period. Deletion is retryable and checks all advertisement references, including shared references, under the same professional lock as mutations. Cleanup logs a fixed message without filenames, identifiers, credentials or media data. Failed records remain for retry. Keep the worker running; public expiry does not depend on it.

Production uses a private S3-compatible bucket via the AWS SDK:

```env
AD_STORAGE=s3
AD_S3_BUCKET=your-private-bucket
AD_S3_REGION=your-region
# Optional for compatible providers:
AD_S3_ENDPOINT=https://your-storage-endpoint
# Supply credentials through the SDK standard environment/provider chain.
# AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must remain secret.
```

Grant only GetObject/PutObject/DeleteObject on `advertisements/*` and `business-media/*`, block public bucket access and use provider encryption. Backend serves media only after access checks. Production local storage is rejected. Provision additive AdvertisementLock.professional and AdvertisementImage.key unique indexes with the existing reviewed index procedure. Do not change storage provider/bucket with existing assets without a reviewed copy/verification plan: stored keys are relative to the selected backend.

Object storage integration is implemented but has not been connected to an external bucket or live-tested. Development filesystem and injected cleanup failure behavior are covered by automated tests. No external accounts were altered.

## User workflow

Open Professional → Advertisements, create a draft, optionally upload an image or video, then Publish. Status and expiration appear in the list; video preview supports playback. Edit preserves the expiration; Unpublish hides immediately; Publish again renews for seven days subject to the active limit. Remove media keeps the ad; Delete removes the owned advertisement after confirmation. Homepage cards link to the professional public profile, which also shows their current advertisements. Admin navigation contains no advertisement management page.
