# RobAI-Club website

This is the Hugo website for RobAI-Club, the Robotics and Artificial Intelligence Association of Hainan University.

The site is based on the public `ymatterlab/ymatterlab.github.io` design and is being rebuilt with RobAI-Club's own content. Personal profiles, project descriptions, images, contact details, and publication records are intentionally kept as placeholders until they are confirmed by the group.

## Content workflow

- Site-wide identity and navigation: `config.yaml`
- Home and page copy: `content/`
- Member and publication data: `data/people.yaml`, `data/publications.yaml`
- Photos, logos, and other assets: `static/images/`
- Page templates: `layouts/`

## Local preview

Install Hugo Extended, then run:

```bash
hugo server -D
```

The GitHub Actions workflow in `.github/workflows/hugo.yml` builds and deploys the site to GitHub Pages after pushes to `main`.

## License

The template source is licensed under the terms of the upstream repository. RobAI-Club text, images, and project materials remain subject to their respective authors' rights unless a different license is stated.
