import React from 'react';
import Plot from 'react-plotly.js';

interface PlotlyChartProps {
  data: any;
}

const PlotlyChart: React.FC<PlotlyChartProps> = ({ data }) => {
  try {
    const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
    
    return (
      <div className="my-4 w-full overflow-hidden rounded-lg border border-gray-200 bg-white p-2">
        <Plot
          data={parsedData.data || []}
          layout={{
            autosize: true,
            margin: { t: 40, b: 40, l: 40, r: 40 },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            font: { family: 'Inter, sans-serif' },
            ...parsedData.layout
          }}
          useResizeHandler={true}
          style={{ width: "100%", height: "100%", minHeight: "400px" }}
          config={{ responsive: true, displayModeBar: false }}
        />
      </div>
    );
  } catch (err) {
    return (
      <div className="p-4 bg-red-50 text-red-500 rounded border border-red-100 text-sm my-4">
        Failed to parse Plotly data. Ensure it is valid JSON.
      </div>
    );
  }
};

export default PlotlyChart;
