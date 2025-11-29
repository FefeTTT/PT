"use strict";

// js/uiHelpers.js
// Global UI helpers: thin wrapper around SweetAlert2 (Swal.fire) with safe
// fallbacks to older swal or native alert/confirm. Exposes helpers on
// window for easy backward compatibility across the project.
(function () {
  'use strict';

  function swalAlertOpt(title, text, icon) {
    try {
      if (window && window.Swal && typeof Swal.fire === 'function') {
        return Swal.fire({
          title: title || '',
          text: text || '',
          icon: icon || 'info'
        });
      }
    } catch (e) {
      console.warn('uiHelpers swalAlertOpt (Swal) error', e);
    }

    try {
      if (window && window.swal && typeof swal === 'function') {
        try {
          return swal(title || '', text || '', icon || 'info');
        } catch (e) {
          /* fallthrough */
        }
      }
    } catch (e) {}

    try {
      alert(text && text.length > 0 ? text : title);
    } catch (e) {
      console.log(title, text);
    }

    return Promise.resolve();
  }

  function swalConfirmOpt(title, text, onConfirm) {
    try {
      if (window && window.Swal && typeof Swal.fire === 'function') {
        return Swal.fire({
          title: title || 'Confirmar',
          text: text || '',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Sí',
          cancelButtonText: 'No'
        }).then(function (result) {
          if (result && result.isConfirmed) {
            try {
              if (typeof onConfirm === 'function') onConfirm();
            } catch (e) {
              console.error(e);
            }
          }
        });
      }
    } catch (e) {
      console.warn('uiHelpers swalConfirmOpt (Swal) error', e);
    }

    try {
      if (window && window.swal && typeof swal === 'function') {
        try {
          var prom = swal({
            title: title || 'Confirmar',
            text: text || '',
            icon: 'warning',
            buttons: true,
            dangerMode: true
          });

          if (prom && typeof prom.then === 'function') {
            return prom.then(function (ok) {
              if (ok) {
                try {
                  if (typeof onConfirm === 'function') onConfirm();
                } catch (e) {
                  console.error(e);
                }
              }
            });
          }
        } catch (e) {}
      }
    } catch (e) {}

    try {
      if (confirm(text || title)) {
        if (typeof onConfirm === 'function') onConfirm();
      }
    } catch (e) {
      console.log('confirm fallback', e);
    }

    return Promise.resolve();
  }

  var _loadingShown = false;

  function swalShowLoading(title) {
    try {
      if (window && window.Swal && typeof Swal.fire === 'function') {
        _loadingShown = true;
        return Swal.fire({
          title: title || 'Cargando...',
          allowOutsideClick: false,
          didOpen: function didOpen() {
            Swal.showLoading();
          }
        });
      }
    } catch (e) {
      console.warn('uiHelpers swalShowLoading error', e);
    } // native fallback: no-op


    return Promise.resolve();
  }

  function swalClose() {
    try {
      if (window && window.Swal && typeof Swal.close === 'function') {
        _loadingShown = false;
        return Swal.close();
      }
    } catch (e) {}

    return;
  }

  var exports = {
    swalAlertOpt: swalAlertOpt,
    swalConfirmOpt: swalConfirmOpt,
    swalShowLoading: swalShowLoading,
    swalClose: swalClose
  };

  try {
    if (typeof window !== 'undefined') {
      window.uiHelpers = exports; // Backwards-compatible globals many modules already reference

      window.swalAlertOpt = swalAlertOpt;
      window.swalConfirmOpt = swalConfirmOpt;
      window.swalShowLoading = swalShowLoading;
      window.swalClose = swalClose;
    }
  } catch (e) {
    /* ignore */
  }

  try {
    if (typeof module !== 'undefined' && module.exports) module.exports = exports;
  } catch (e) {}
})();