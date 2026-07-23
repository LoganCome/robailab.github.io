# RobAI-Club website

This is the Hugo website for RobAI-Club, the Robotics and Artificial Intelligence Association of Hainan University.

The site is based on the public `ymatterlab/ymatterlab.github.io` design and is being rebuilt with RobAI-Club's own content. Personal profiles, project descriptions, images, contact details, and publication records are intentionally kept as placeholders until they are confirmed by the group.

## Content workflow

- Site-wide identity and navigation: `config.yaml`
- Home and page copy: `content/`
- Member and publication data: `data/people.yaml`, `data/publications.yaml`
- Photos, logos, and other assets: `static/images/`
- Page templates: `layouts/`

## Content management platform

The repository includes a Decap CMS interface at `/admin/` for reviewed updates to bilingual pages, news, people, publications, honors, images, and public files. GitHub collaborator permissions control access. The one-time OAuth owner setup is documented in `cms-auth/README.md`, and editor guidance is available in `docs/content-management.md`.

## Local preview

Install Hugo Extended, then run:

```bash
hugo server -D
```

The workflow in `.github/workflows/hugo.yml` can build and deploy after pushes to `main`. While Actions is unavailable for the account, maintainers build locally and push the generated site to `gh-pages`.

## License

The template source is licensed under the terms of the upstream repository. RobAI-Club text, images, and project materials remain subject to their respective authors' rights unless a different license is stated.
