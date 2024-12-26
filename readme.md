# API Documentation

#### image endpoint details

- GET call with Authentification.
- can optimize images in Journeys. Overview images and Assets
- /v2/image/{journeyID}/{type}/{imageID}/{size}/{format}
- - joruneyID: is the current journey ID
- - type: (a or o. a= asset and o= overview)
- - imagedID: the current image ID including ext.
- - size: (x-small, small, medium large x-large).

    'x-small': 300,
    'small': 640,
    'medium': 1024,
    'large': 1440,
    'x-large': 2560

- - format: original, jpeg, jpg, png, gif or webp

#### translate endpoint details

- - journeyId and targetLang as body parameter
example:
´{
    "journeyId":"9f65f6a8-7558-47b9-8111-6f6b82089c2f",
    "targetLang":"German"
}´



## API Endpoints migration to V2
  1. DELETE - /v2/file/delete-file
  1. DELETE - /v2/journey-category/{ID}
  1. DELETE - /v2/tenant/{id}
  1. DELETE - /v2/user-notifications/{ID}
  1. GET - /v2/user/devicelist
  1. GET - /v2/image/{journeyID}/{type}/{imageID}/{size}/{format}
  1. POST - /v2/journey/translate
  1. POST - /v2/add-custom-attributes-to-user-pool
  1. POST - /v2/add-user-to-journey
  1. POST - /v2/align-users-expiration-date
  1. POST - /v2/check-existing-users
  1. POST - /v2/create-users
  1. POST - /v2/delete-user
  1. POST - /v2/file/copy-file-to-S3-folder
  1. POST - /v2/file/get-download-signed-url
  1. POST - /v2/file/get-tenant-logo-signed-url
  1. POST - /v2/file/get-upload-signed-url
  1. POST - /v2/get-journeys-linked-to-participant
  1. POST - /v2/get-participants-linked-to-author
  1. POST - /v2/get-users-linked-to-journey
  1. POST - /v2/internal-currency/add-amount
  1. POST - /v2/internal-currency/get-amount
  1. POST - /v2/journey-category/create
  1. POST - /v2/journey-category/list
  1. POST - /v2/journey-reusable-templates/add-to-pending
  1. POST - /v2/journey-reusable-templates/list
  1. POST - /v2/journey-reusable-templates/list-reusable-templates
  1. POST - /v2/journey-reusable-templates/update-template-status
  1. POST - /v2/journey/check-journeys-chapters-unlock
  1. POST - /v2/journey/copy-journey
  1. POST - /v2/journey/create
  1. POST - /v2/journey/list
  1. POST - /v2/journey/list-all-journeys-names
  1. POST - /v2/journey/list-user-journeys
  1. POST - /v2/journey/update-journey-user-consent
  1. POST - /v2/journey/update-participant-assignment
  1. POST - /v2/list-journeys-images
  1. POST - /v2/list-users
  1. POST - /v2/list-users-by-role
  1. POST - /v2/remove-participant-from-journey
  1. POST - /v2/reusable-assets/add-existing-image-to-reusable-journeys-images
  1. POST - /v2/reusable-assets/list-reusable-journeys-images
  1. POST - /v2/tenant
  1. POST - /v2/tenant-admin-update-user
  1. POST - /v2/tenant/update-logo
  1. POST - /v2/tenantinfo/{name}
  1. POST - /v2/treasure-chest/get-treasure-chest-for-user
  1. POST - /v2/update-participant-by-author
  1. POST - /v2/upload/image/upload
  1. POST - /v2/upload/profile/check
  1. POST - /v2/user-notifications/get
  1. POST - /v2/user-preferences/get
  1. POST - /v2/user-preferences/update-journeys-notes
  1. POST - /v2/user-preferences/update-language
  1. POST - /v2/user-preferences/update-last-journey-id
  1. POST - /v2/user-preferences/update-tags
  1. POST - /v2/user-preferences/update-treasure-chest-filters
  1. POST - /v2/user/verifyUserEmail
  1. PUT - /v2/journey-category/{ID}
  1. PUT - /v2/journey/{ID}
  1. PUT - /v2/journey/set-participants-progress
  1. PUT - /v2/journey/update-active-status/{ID}
  1. PUT - /v2/journey/update-author/{ID}
  1. PUT - /v2/journey/update-participant-progress
  1. PUT - /v2/tenant/{id}
  1. PUT - /v2/user-update-roles/{ID}
  1. PUT - /v2/user/{id}
  1. PUT - /v2/user/picture/{id}




## API Endpoints V1
  1. DELETE - /file/delete-file
  1. DELETE - /journey-category/{ID}
  1. DELETE - /tenant/{id}
  1. DELETE - /user-notifications/{ID}
  1. GET - /user/devicelist
  1. GET - /v2/image/{journeyID}/{type}/{imageID}/{size}/{format}
  1. POST - /add-custom-attributes-to-user-pool
  1. POST - /add-user-to-journey
  1. POST - /align-users-expiration-date
  1. POST - /check-existing-users
  1. POST - /create-users
  1. POST - /delete-user
  1. POST - /file/copy-file-to-S3-folder
  1. POST - /file/get-download-signed-url
  1. POST - /file/get-tenant-logo-signed-url
  1. POST - /file/get-upload-signed-url
  1. POST - /get-journeys-linked-to-participant
  1. POST - /get-participants-linked-to-author
  1. POST - /get-users-linked-to-journey
  1. POST - /internal-currency/add-amount
  1. POST - /internal-currency/get-amount
  1. POST - /journey-category/create
  1. POST - /journey-category/list
  1. POST - /journey-reusable-templates/add-to-pending
  1. POST - /journey-reusable-templates/list
  1. POST - /journey-reusable-templates/list-reusable-templates
  1. POST - /journey-reusable-templates/update-template-status
  1. POST - /journey/check-journeys-chapters-unlock
  1. POST - /journey/copy-journey
  1. POST - /journey/create
  1. POST - /journey/list
  1. POST - /journey/list-all-journeys-names
  1. POST - /journey/list-user-journeys
  1. POST - /journey/update-journey-user-consent
  1. POST - /journey/update-participant-assignment
  1. POST - /list-journeys-images
  1. POST - /list-users
  1. POST - /list-users-by-role
  1. POST - /remove-participant-from-journey
  1. POST - /reusable-assets/add-existing-image-to-reusable-journeys-images
  1. POST - /reusable-assets/list-reusable-journeys-images
  1. POST - /tenant
  1. POST - /tenant-admin-update-user
  1. POST - /tenant/update-logo
  1. POST - /tenantinfo/{name}
  1. POST - /treasure-chest/get-treasure-chest-for-user
  1. POST - /update-participant-by-author
  1. POST - /upload/image/upload
  1. POST - /upload/profile/check
  1. POST - /user-notifications/get
  1. POST - /user-preferences/get
  1. POST - /user-preferences/update-journeys-notes
  1. POST - /user-preferences/update-language
  1. POST - /user-preferences/update-last-journey-id
  1. POST - /user-preferences/update-tags
  1. POST - /user-preferences/update-treasure-chest-filters
  1. POST - /user/verifyUserEmail
  1. PUT - /journey-category/{ID}
  1. PUT - /journey/{ID}
  1. PUT - /journey/set-participants-progress
  1. PUT - /journey/update-active-status/{ID}
  1. PUT - /journey/update-author/{ID}
  1. PUT - /journey/update-participant-progress
  1. PUT - /tenant/{id}
  1. PUT - /user-update-roles/{ID}
  1. PUT - /user/{id}
  1. PUT - /user/picture/{id}
