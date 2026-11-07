from collections import deque


def shortest_path(grid, start, goal):
    """Return the shortest path from start to goal on a grid (0 = open, 1 = wall)
    as a list of (row, col) cells, or None if the goal is unreachable."""
    if not grid or not grid[0]:
        return None
    rows, cols = len(grid), len(grid[0])
    queue = deque([(start, [start])])
    visited = set()

    while queue:
        cell, path = queue.popleft()
        if cell in visited:
            continue
        visited.add(cell)
        if cell == goal:
            return path
        r, c = cell
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] == 0:
                if (nr, nc) not in visited:
                    queue.append(((nr, nc), path + [(nr, nc)]))
    return None


if __name__ == "__main__":
    grid = [
        [0, 0, 0],
        [1, 1, 0],
        [0, 0, 0],
    ]
    assert shortest_path(grid, (0, 0), (2, 0)) == [(0, 0), (0, 1), (0, 2), (1, 2), (2, 2), (2, 1), (2, 0)]
    assert shortest_path(grid, (0, 0), (0, 0)) == [(0, 0)]
    assert shortest_path([[0, 1], [1, 0]], (0, 0), (1, 1)) is None
    assert shortest_path([], (0, 0), (0, 0)) is None
    print("All tests pass.")
