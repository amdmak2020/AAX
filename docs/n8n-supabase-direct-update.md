# n8n Direct Supabase Job Updates

Use this when the app is running locally. n8n cannot call `localhost`, so n8n should update Supabase directly after the render finishes.

## Required Inputs From App

The app sends this payload to n8n:

```json
{
  "jobId": "supabase-video-job-id",
  "userId": "supabase-user-id",
  "mode": "twitter",
  "title": "Project title",
  "twitterUrl": "https://x.com/...",
  "url": "https://x.com/...",
  "videoUrl": "https://x.com/...",
  "style": "Clean Split",
  "voice": "Original audio",
  "callbackUrl": "http://localhost:3001/api/webhooks/n8n"
}
```

For direct Supabase updates, ignore `callbackUrl`. Use `jobId`.

## Supabase REST Base

```txt
https://ptlpjrkyuztofbsfefzk.supabase.co/rest/v1/video_jobs
```

## Headers

Create an n8n credential or variables for these. Do not expose the service role key in frontend code.

```txt
apikey: YOUR_SUPABASE_SERVICE_ROLE_KEY
Authorization: Bearer YOUR_SUPABASE_SERVICE_ROLE_KEY
Content-Type: application/json
Prefer: return=representation
```

## Mark Job Processing

Optional, near the beginning of the workflow.

HTTP Request node:

```txt
Method: PATCH
URL: https://ptlpjrkyuztofbsfefzk.supabase.co/rest/v1/video_jobs?id=eq.{{$json.jobId}}
Send Body: JSON
```

Body:

```json
{
  "status": "processing",
  "progress": 25,
  "updated_at": "={{ new Date().toISOString() }}"
}
```

## Mark Job Rendering

Optional, before the final video render/export step.

HTTP Request node:

```txt
Method: PATCH
URL: https://ptlpjrkyuztofbsfefzk.supabase.co/rest/v1/video_jobs?id=eq.{{$json.jobId}}
Send Body: JSON
```

Body:

```json
{
  "status": "rendering",
  "progress": 75,
  "updated_at": "={{ new Date().toISOString() }}"
}
```

## Mark Job Completed

Use this after the final video URL is available.

HTTP Request node:

```txt
Method: PATCH
URL: https://ptlpjrkyuztofbsfefzk.supabase.co/rest/v1/video_jobs?id=eq.{{$json.jobId}}
Send Body: JSON
```

Body:

```json
{
  "status": "completed",
  "progress": 100,
  "output_asset_path": "={{ $json.outputUrl }}",
  "error_message": null,
  "updated_at": "={{ new Date().toISOString() }}"
}
```

Replace `$json.outputUrl` with the actual field that contains the finished video URL in your workflow.

Common alternatives:

```txt
={{ $json.url }}
={{ $json.videoUrl }}
={{ $json.fileUrl }}
={{ $('Upload final video').item.json.url }}
```

## Mark Job Failed

Use this on an error branch.

HTTP Request node:

```txt
Method: PATCH
URL: https://ptlpjrkyuztofbsfefzk.supabase.co/rest/v1/video_jobs?id=eq.{{$json.jobId}}
Send Body: JSON
```

Body:

```json
{
  "status": "failed",
  "progress": 0,
  "error_message": "={{ $json.error?.message || $json.message || 'The render failed.' }}",
  "updated_at": "={{ new Date().toISOString() }}"
}
```

## Quick Test

After the final update node runs, refresh the job detail page in the app. The page auto-refreshes every 5 seconds while the job is active, so it should move to completed and show the download button once `output_asset_path` is set.

