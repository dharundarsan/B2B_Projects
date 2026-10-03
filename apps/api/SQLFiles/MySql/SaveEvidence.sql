INSERT INTO evidence(workspace_id,request_id,id,path,name,content_type,size,uploaded_by,created_at,status)
            VALUES(@workspace,@request,@Id,@Path,@Name,@ContentType,@Size,@UploadedBy,@CreatedAt,@Status)
