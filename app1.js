const state = {
    products: [],
};

const elements = {
    table: document.querySelector('#productsTable'),
    tableBody: document.querySelector('#productsGrid'),
    loading: document.querySelector('#loadingState'),
    error: document.querySelector('#errorState'),
    empty: document.querySelector('#emptyState'),
    search: document.querySelector('#searchInput'),
    clearSearch: document.querySelector('#clearSearch'),
    category: document.querySelector('#categoryFilter'),
    summary: document.querySelector('#resultSummary'),
    retry: document.querySelector('#retryButton'),
};

document.addEventListener('DOMContentLoaded', loadProducts);
elements.search.addEventListener('input', renderTable);
elements.category.addEventListener('change', renderTable);
elements.tableBody.addEventListener('click', copyProductId);
elements.clearSearch.addEventListener('click', () => {
    elements.search.value = '';
    renderTable();
    elements.search.focus();
});
elements.retry.addEventListener('click', loadProducts);

async function loadProducts() {
    showState('loading');

    try {
        const response = await fetch('products2.json', { cache: 'no-store' });
        if (!response.ok) throw new Error(`products2.json returned ${response.status}`);

        const products = await response.json();
        if (!Array.isArray(products)) throw new Error('JSON root must be an array.');

        state.products = products.filter((product) => product.available === true && !isPersianCategory(product.category_name));
        fillCategories();
        renderTable();
    } catch (error) {
        console.error(error);
        showState('error');
    }
}

function fillCategories() {
    const categories = [...new Set(state.products.map((product) => clean(product.category_name) || 'بدون کتگوری'))]
        .sort((a, b) => a.localeCompare(b, 'fa'));

    elements.category.innerHTML = '<option value="all">همه کتگوری‌ها</option>';
    categories.forEach((category) => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        elements.category.appendChild(option);
    });
}

function isPersianCategory(value) {
    // بعضی کتگوری‌های فارسی در JSON با encoding نادرست به شکل Ø / Ù / Û / Ú ذخیره شده‌اند.
    return /[ØÙÛÚ\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(clean(value));
}

function renderTable() {
    const query = clean(elements.search.value).toLocaleLowerCase();
    const selectedCategory = elements.category.value;

    const visibleProducts = state.products.filter((product) => {
        const category = clean(product.category_name) || 'بدون کتگوری';
        const searchableText = [
            product.id,
            product.name,
            category,
            product.product_type,
            ...(Array.isArray(product.params) ? product.params : []),
        ].map(clean).join(' ').toLocaleLowerCase();

        return (!query || searchableText.includes(query))
            && (selectedCategory === 'all' || category === selectedCategory);
    });

    visibleProducts.sort((first, second) => {
        const firstCategory = clean(first.category_name) || 'بدون کتگوری';
        const secondCategory = clean(second.category_name) || 'بدون کتگوری';
        const categoryOrder = firstCategory.localeCompare(secondCategory, 'fa');

        if (categoryOrder !== 0) return categoryOrder;
        return clean(first.name).localeCompare(clean(second.name), 'fa');
    });

    elements.tableBody.innerHTML = visibleProducts.map(productRow).join('');
    elements.summary.textContent = `${toEnglishDigits(visibleProducts.length)} محصول از ${toEnglishDigits(state.products.length)}`;
    elements.clearSearch.hidden = !elements.search.value;

    showState(visibleProducts.length ? 'table' : 'empty');
}

function productRow(product) {
    const category = clean(product.category_name) || 'بدون کتگوری';
    const categoryImage = clean(product.category_img);
    const imageCell = categoryImage
        ? `<img class="category-image" src="${escapeAttribute(categoryImage)}" alt="${escapeAttribute(category)}" loading="lazy" onerror="this.outerHTML='<span class=&quot;category-image-placeholder&quot;>بدون تصویر</span>'">`
        : '<span class="category-image-placeholder">بدون تصویر</span>';

    return `
        <tr>
            <td class="product-id">${toEnglishDigits(product.id ?? '—')}</td>
            <td><button type="button" class="btn btn-sm btn-outline-primary copy-id-btn" data-copy-id="${escapeAttribute(product.id ?? '')}">کپی آیدی</button></td>
            <td class="product-name">${escapeHtml(clean(product.name) || 'بدون نام')}</td>
            <td>${escapeHtml(category)}</td>
            <td>${imageCell}</td>
            <td class="muted-cell">${escapeHtml(quantityText(product.qty_values))}</td>
        </tr>`;
}

function quantityText(values) {
    if (!values) return '—';
    if (Array.isArray(values)) return values.map(toEnglishDigits).join('، ');
    if (typeof values === 'object' && values.min !== undefined && values.max !== undefined) {
        return `${toEnglishDigits(values.min)} تا ${toEnglishDigits(values.max)}`;
    }
    return '—';
}

function formatPrice(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '—';

    const digits = number !== 0 && Math.abs(number) < 0.01 ? 10 : 2;
    return toEnglishDigits(new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(number));
}

function clean(value) {
    return value === null || value === undefined ? '' : String(value).trim();
}

function toEnglishDigits(value) {
    return String(value)
        .replace(/[۰-۹]/g, (digit) => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)])
        .replace(/[٠-٩]/g, (digit) => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(digit)]);
}

function escapeHtml(value) {
    return clean(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function escapeAttribute(value) {
    return escapeHtml(value);
}

async function copyProductId(event) {
    const button = event.target.closest('[data-copy-id]');
    if (!button) return;

    const originalText = button.textContent;
    try {
        await copyText(button.dataset.copyId);
        button.textContent = 'کپی شد';
        button.classList.remove('btn-outline-primary');
        button.classList.add('btn-success');
    } catch (error) {
        console.error('Unable to copy product id:', error);
        button.textContent = 'کپی نشد';
        button.classList.remove('btn-outline-primary');
        button.classList.add('btn-danger');
    }

    window.setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove('btn-success', 'btn-danger');
        button.classList.add('btn-outline-primary');
    }, 1400);
}

async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();

    if (!copied) throw new Error('Copy command failed.');
}

function showState(view) {
    elements.loading.hidden = view !== 'loading';
    elements.error.hidden = view !== 'error';
    elements.empty.hidden = view !== 'empty';
    elements.table.hidden = view !== 'table';
}
