CREATE POLICY "Admins manage getaway images"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'getaway-images' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'getaway-images' AND public.is_admin(auth.uid()));