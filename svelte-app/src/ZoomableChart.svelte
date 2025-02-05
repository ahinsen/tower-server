<script>
    import { Line } from 'svelte-chartjs';
    import 'chartjs-plugin-zoom';
    import { onMount } from 'svelte';

    let chartData = {
        labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July'],
        datasets: [
            {
                label: 'My First dataset',
                backgroundColor: 'rgba(75,192,192,0.4)',
                borderColor: 'rgba(75,192,192,1)',
                data: [65, 59, 80, 81, 56, 55, 40]
            }
        ]
    };

    let chartOptions = {
        responsive: true,
        plugins: {
            zoom: {
                pan: {
                    enabled: true,
                    mode: 'xy'
                },
                zoom: {
                    enabled: true,
                    mode: 'xy'
                }
            }
        }
    };

    onMount(() => {
        // Any additional setup can be done here
    });
</script>

<Line {chartData} {chartOptions} />