import { useState } from 'react';
import { apiBase } from '../api/client';
import './ProductImage.css';

export function productImageUrl(idproducto: number): string {
  return apiBase() + '/img/producto/' + idproducto;
}

export function ProductImage({
  idproducto,
  alt,
  size = 'md'
}: {
  idproducto: number;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className={'prod-img prod-img-' + size + ' prod-img-fallback'} aria-hidden="true" />;
  return (
    <img
      className={'prod-img prod-img-' + size}
      src={productImageUrl(idproducto)}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
