// scripts/ui-destructive.test.mjs
// Unit coverage for the UI destructive-element classifier: Spanish keyword
// matching (D-06), the fail-closed empty-accessible-name case, and value
// exclusion from the confirmation preview.

import { describe, expect, it } from 'vitest';
import {
  UI_DESTRUCTIVE_KEYWORDS,
  previewOfElement,
  requiresConfirmationForElement,
} from './ui-destructive.mjs';

describe('requiresConfirmationForElement', () => {
  it('returns true for the D-06 keywords and their siblings on visible text alone', () => {
    const destructiveLabels = [
      'Eliminar cliente',
      'ELIMINAR',
      'Borrar factura',
      'Dar de baja',
      'Confirmar pago',
      'Cancelar suscripción',
      'Anular recibo',
      'Suspender usuario',
      'Rechazar solicitud',
      'Enviar notificación por email',
    ];

    for (const label of destructiveLabels) {
      expect(requiresConfirmationForElement(label)).toBe(true);
    }
  });

  it('returns true when the visible text is benign but the aria-label carries the keyword', () => {
    expect(
      requiresConfirmationForElement('Papelera', { ariaLabel: 'Eliminar el registro seleccionado' })
    ).toBe(true);
  });

  it('returns true when the visible text carries the keyword and the aria-label is absent', () => {
    expect(requiresConfirmationForElement('Eliminar cuenta')).toBe(true);
  });

  it('returns false for benign labels', () => {
    const benignLabels = ['Guardar', 'Buscar', 'Filtrar', 'Ver detalle', 'Exportar a Excel', 'Siguiente', 'Volver'];

    for (const label of benignLabels) {
      expect(requiresConfirmationForElement(label)).toBe(false);
    }
  });

  it('fails closed for an empty string, a whitespace-only string, undefined and null — text position', () => {
    expect(requiresConfirmationForElement('')).toBe(true);
    expect(requiresConfirmationForElement('   ')).toBe(true);
    expect(requiresConfirmationForElement(undefined)).toBe(true);
    expect(requiresConfirmationForElement(null)).toBe(true);
  });

  it('fails closed for an empty string, a whitespace-only string, undefined and null — ariaLabel position', () => {
    expect(requiresConfirmationForElement(undefined, { ariaLabel: '' })).toBe(true);
    expect(requiresConfirmationForElement(undefined, { ariaLabel: '   ' })).toBe(true);
    expect(requiresConfirmationForElement(undefined, { ariaLabel: undefined })).toBe(true);
    expect(requiresConfirmationForElement(undefined, { ariaLabel: null })).toBe(true);
  });

  it('is case-insensitive and matches on substrings', () => {
    expect(requiresConfirmationForElement('Eliminar definitivamente')).toBe(true);
    expect(requiresConfirmationForElement('eliminar definitivamente')).toBe(true);
    expect(requiresConfirmationForElement('ELIMINAR DEFINITIVAMENTE')).toBe(true);
  });

  it('exports UI_DESTRUCTIVE_KEYWORDS containing at least the five D-06 keywords', () => {
    expect(Array.isArray(UI_DESTRUCTIVE_KEYWORDS)).toBe(true);
    for (const kw of ['eliminar', 'borrar', 'cancelar', 'confirmar pago', 'dar de baja']) {
      expect(UI_DESTRUCTIVE_KEYWORDS).toContain(kw);
    }
  });
});

describe('previewOfElement', () => {
  it('returns an object carrying text, ariaLabel, ref and url', () => {
    const preview = previewOfElement({
      text: 'Eliminar',
      ariaLabel: 'Eliminar el registro',
      ref: 'e12',
      url: 'http://x.test/clients',
    });

    expect(preview).toEqual({
      text: 'Eliminar',
      ariaLabel: 'Eliminar el registro',
      ref: 'e12',
      url: 'http://x.test/clients',
    });
  });

  it('carries no value, fields or password key under any circumstance', () => {
    const preview = previewOfElement({
      text: 'Eliminar',
      ariaLabel: null,
      ref: 'e12',
      url: 'http://x.test/clients',
    });

    expect(preview.value).toBeUndefined();
    expect(preview.fields).toBeUndefined();
    expect(preview.password).toBeUndefined();
  });

  it('still has no value property when the input object also carries one, because it is built by explicit field assignment', () => {
    const preview = previewOfElement({
      text: 'Eliminar',
      ariaLabel: null,
      ref: 'e12',
      url: 'http://x.test/clients',
      value: 'hunter2',
      fields: [{ value: 'hunter2' }],
    });

    expect(preview.value).toBeUndefined();
    expect(preview.fields).toBeUndefined();
    expect(JSON.stringify(preview)).not.toContain('hunter2');
  });
});
