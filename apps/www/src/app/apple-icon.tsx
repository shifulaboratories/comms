import { ImageResponse } from 'next/og';

/** Home-screen and iMessage-contact icon; iOS ignores SVG favicons. */
export const dynamic = 'force-static';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #64AAFF, #7C6CFF)',
      }}
    >
      <div
        style={{
          display: 'flex',
          width: 104,
          height: 78,
          borderRadius: 26,
          background: '#fff',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 11,
        }}
      >
        <div style={{ width: 14, height: 14, borderRadius: 14, background: '#3D6BFF' }} />
        <div style={{ width: 14, height: 14, borderRadius: 14, background: '#3D6BFF' }} />
        <div style={{ width: 14, height: 14, borderRadius: 14, background: '#3D6BFF' }} />
      </div>
    </div>,
    size,
  );
}
