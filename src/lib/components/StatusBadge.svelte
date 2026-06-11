<script lang="ts">
	import { STATUS_LABELS, STATUS_TONE } from '$lib/status';
	import type { RouteStatus } from '$lib/types';

	let { status, detail = null }: { status: RouteStatus; detail?: string | null } = $props();
</script>

<span class="badge {STATUS_TONE[status]}" title={detail ?? STATUS_LABELS[status]}>
	{STATUS_LABELS[status]}
</span>

<style>
	.badge {
		display: inline-block;
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		padding: 0.1rem 0.45rem;
		border-radius: 999px;
		border: 1px solid transparent;
		white-space: nowrap;
	}
	.ok {
		background: #e3f1e9;
		color: #1d5c3c;
		border-color: #bcdcc9;
	}
	.warn {
		background: #fdf3e0;
		color: #8a5a00;
		border-color: #f0ddb5;
	}
	.neutral {
		background: #efede6;
		color: var(--muted);
		border-color: #dcd8cc;
	}
	.danger {
		background: #fdecea;
		color: #b3261e;
		border-color: #f3c2be;
	}
</style>
