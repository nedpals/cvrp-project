from typing import List, Dict
from dataclasses import dataclass
from models.location import Location
from models.shared_models import AVERAGE_SPEED_KPH
import numpy as np
from sklearn.cluster import KMeans

@dataclass
class GeographicCluster:
    id: str
    locations: List[Location]
    total_wco: float
    center_lat: float
    center_lon: float
    total_time: float  # Total estimated collection time for cluster

class GeographicClusterer:
    """Clusters locations based on geographic proximity, WCO capacity, and time constraints"""
    
    def __init__(self, target_clusters: int = 5, capacity_threshold: float = 2000, max_time_per_stop: float = 7.0):
        self.target_clusters = target_clusters
        self.capacity_threshold = capacity_threshold
        self.max_time_per_stop = max_time_per_stop
        self.SPEED_KPH = AVERAGE_SPEED_KPH
        
    def estimate_collection_time(self, location: Location) -> float:
        """Estimate collection time based on WCO amount, capped at max_time_per_stop"""
        # base_time = 3 + (location.wco_amount / 100) * 4  # Base 3 mins + up to 4 more based on volume
        # return min(self.max_time_per_stop, base_time)
        return self.max_time_per_stop

    def cluster_locations(self, locations: List[Location], pure_geographic: bool = True) -> List[GeographicCluster]:
        """
        Cluster locations with option for pure geographic clustering
        pure_geographic: When True, only considers distances for clustering
        """
        if not locations:
            return []

        coords = np.array([[loc.coordinates[0], loc.coordinates[1]] for loc in locations])
        
        # Determine maximum possible clusters based on location count
        max_possible_clusters = min(len(locations), self.target_clusters)
        if max_possible_clusters < 2:
            return [self._create_cluster(0, locations)]
            
        best_clusters = None
        best_score = float('inf')
        
        for n_clusters in range(2, max_possible_clusters + 1):
            kmeans = KMeans(n_clusters=n_clusters, random_state=42)
            labels = kmeans.fit_predict(coords)
            
            temp_clusters: Dict[int, List[Location]] = {}
            for idx, label in enumerate(labels):
                if label not in temp_clusters:
                    temp_clusters[label] = []
                temp_clusters[label].append(locations[idx])
            
            if pure_geographic:
                # Only evaluate geographic cohesion
                score = self._evaluate_geographic_clustering(temp_clusters)
            else:
                # Use full evaluation including capacity and time
                score = self._evaluate_clustering(temp_clusters)
            
            if score < best_score:
                best_score = score
                best_clusters = temp_clusters

        # Create GeographicCluster objects and sort locations within each cluster
        result = []
        for label, cluster_locs in best_clusters.items():
            # Sort locations by WCO amount within cluster
            cluster_locs.sort(key=lambda x: (-x.wco_amount, x.coordinates[0], x.coordinates[1]))
            result.append(self._create_cluster(label, cluster_locs))
        
        result.sort(key=lambda x: x.id)
        return result

    def _create_cluster(self, label: int, locations: List[Location]) -> GeographicCluster:
        """Helper method to create a cluster from locations"""
        # Calculate cluster metrics
        center_lat = np.mean([loc.coordinates[0] for loc in locations])
        center_lon = np.mean([loc.coordinates[1] for loc in locations])
        total_wco = sum(loc.wco_amount for loc in locations)
        total_time = sum(self.estimate_collection_time(loc) for loc in locations)
        
        # Sort locations by WCO amount within cluster
        locations.sort(key=lambda x: x.wco_amount, reverse=True)
        
        return GeographicCluster(
            id=chr(65 + label),
            locations=locations,
            total_wco=total_wco,
            center_lat=center_lat,
            center_lon=center_lon,
            total_time=total_time
        )

    def _evaluate_clustering(self, clusters: Dict[int, List[Location]]) -> float:
        """Score clustering based on capacity balance, time constraints, and geographic cohesion"""
        score = 0.0
        
        for cluster_locs in clusters.values():
            # Check capacity balance
            total_wco = sum(loc.wco_amount for loc in cluster_locs)
            capacity_penalty = abs(total_wco - self.capacity_threshold) / self.capacity_threshold
            
            # Check time constraints
            total_time = sum(self.estimate_collection_time(loc) for loc in cluster_locs)
            time_penalty = max(0, total_time - (self.max_time_per_stop * len(cluster_locs)))
            
            # Check geographic cohesion (average distance between points)
            center_lat = np.mean([loc.coordinates[0] for loc in cluster_locs])
            center_lon = np.mean([loc.coordinates[1] for loc in cluster_locs])
            distances = [
                np.sqrt((loc.coordinates[0] - center_lat)**2 + (loc.coordinates[1] - center_lon)**2)
                for loc in cluster_locs
            ]
            cohesion_penalty = np.mean(distances) if distances else 0
            
            # Add traffic-based penalty
            avg_distance_km = np.mean(distances) if distances else 0
            travel_time = (avg_distance_km / self.SPEED_KPH) * 60  # minutes
            traffic_penalty = travel_time / 60  # Penalize longer travel times
            
            score += capacity_penalty + time_penalty + cohesion_penalty + traffic_penalty
            
        return score

    def _evaluate_geographic_clustering(self, clusters: Dict[int, List[Location]]) -> float:
        """Evaluate clustering based purely on geographic cohesion"""
        score = 0.0
        
        for cluster_locs in clusters.values():
            # Calculate cluster center
            center_lat = np.mean([loc.coordinates[0] for loc in cluster_locs])
            center_lon = np.mean([loc.coordinates[1] for loc in cluster_locs])
            
            # Calculate distances from center
            distances = [
                np.sqrt((loc.coordinates[0] - center_lat)**2 + (loc.coordinates[1] - center_lon)**2)
                for loc in cluster_locs
            ]
            
            # Penalize spread-out clusters
            avg_distance = np.mean(distances) if distances else 0
            max_distance = max(distances) if distances else 0
            
            # Add penalties
            score += (avg_distance * 3.0)  # Base distance penalty
            score += (max_distance * 2.0)  # Extra penalty for outliers
            
            # Penalize very small or large clusters
            ideal_size = len(cluster_locs) / len(clusters)
            size_deviation = abs(len(cluster_locs) - ideal_size) / ideal_size
            score += size_deviation * 0.5
            
        return score

    def print_cluster_analysis(self, clusters: List[GeographicCluster]):
        """Print detailed analysis of clusters"""
        print("\nCluster Analysis:")
        print("=" * 80)
        
        for cluster in clusters:
            print(f"\nCLUSTER {cluster.id}")
            print("-" * 40)
            print(f"Center: ({cluster.center_lat:.6f}, {cluster.center_lon:.6f})")
            print(f"Total WCO: {cluster.total_wco:.2f}L")
            print(f"Total Collection Time: {cluster.total_time:.1f} minutes")
            print(f"Average Time per Stop: {cluster.total_time/len(cluster.locations):.1f} minutes")
            print("\nLocations:")
            for loc in cluster.locations:
                collection_time = self.estimate_collection_time(loc)
                print(f"  {loc.name:<30} {loc.wco_amount:>8.2f}L {collection_time:>5.1f}min")
                print(f"    Coordinates: ({loc.coordinates[0]:.6f}, {loc.coordinates[1]:.6f})")
