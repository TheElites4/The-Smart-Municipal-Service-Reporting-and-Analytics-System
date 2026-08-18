export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'w-32 h-32',
    md: 'w-40 h-40',
    lg: 'w-48 h-48',
  };

  return (
    <div className="flex flex-col items-center">
      <img
        src="/src/imports/WhatsApp_Image_2026-05-11_at_21.44.38.jpeg"
        alt="MzansiReport Logo"
        className={`${sizes[size]} object-contain mb-2`}
      />
    </div>
  );
}
