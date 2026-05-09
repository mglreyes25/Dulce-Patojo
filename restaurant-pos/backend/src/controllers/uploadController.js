const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Cliente especial con service_role key → bypasea RLS en Storage
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * POST /productos/upload-imagen
 * Recibe el archivo vía multer (req.file), lo sube a Supabase Storage
 * en el bucket "imagenes" y devuelve la URL pública.
 */
const subirImagen = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ninguna imagen' });
  }

  const ext    = req.file.originalname.split('.').pop();
  const nombre = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const ruta   = `productos/${nombre}`;

  try {
    const { error } = await supabaseAdmin.storage
      .from('imagenes')
      .upload(ruta, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (error) throw error;

    const { data } = supabaseAdmin.storage.from('imagenes').getPublicUrl(ruta);

    res.json({ url: data.publicUrl });
  } catch (e) {
    console.error('Error subiendo imagen a Supabase Storage:', e);
    res.status(500).json({ error: 'Error al subir la imagen' });
  }
};

module.exports = { subirImagen };